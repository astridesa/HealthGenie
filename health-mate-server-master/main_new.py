import os
import re
import json
import random
import time
import openai
import pandas as pd
import networkx as nx
from datetime import datetime

# --------------------- 1. Azure OpenAI Configuration ---------------------
endpoint = os.getenv("ENDPOINT_URL", "https://60649-m6q4t7cw-eastus2.openai.azure.com/")
deployment = os.getenv("DEPLOYMENT_NAME", "gpt-4o")
subscription_key = os.getenv(
    "AZURE_OPENAI_API_KEY",
    "3G6NJ6fwi6zmNoJyPoqrpZBE0IjzqCGlDEIKFQrsbUW2U86rmXW8JQQJ99BBACHYHv6XJ3w3AAAAACOGhgbr",
)

openai.api_type = "azure"
openai.api_base = endpoint
openai.api_key = subscription_key
openai.api_version = "2024-05-01-preview"

# --------------------- 2. Global CSV Path ---------------------
CSV_PATH = "./merged_cleaned_all_recipes.csv"

def init_history_file():
    """
    为本次会话生成一个独立的history文件，形如 .history_20230405_153210.csv
    这样不同的代码运行(对话窗口)不会互相干扰。
    """
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    global HISTORY_CSV
    HISTORY_CSV = f".history_{timestamp}.csv"
    # 初始化该文件
    if not os.path.exists(HISTORY_CSV):
        df = pd.DataFrame(columns=["round", "type", "content", "time"])
        df.to_csv(HISTORY_CSV, index=False, encoding="utf-8-sig")


# --------------------- 3. NutritionKG Class ---------------------
class NutritionKG:
    def __init__(self, csv_path: str = CSV_PATH):
        self.csv_path = csv_path

    def advanced_search(
        self,
        relation_filter: str,
        object_filter: str = None,
        exact_relation: bool = True,
    ) -> pd.DataFrame:
        """
        在大 CSV 上分块搜索符合条件的 (subject, relation, object) 三元组，
        额外保留其在原始 CSV 中的行号 csv_idx，用于后续英文行的检索。
        """
        usecols = ["subject", "relation", "object"]
        chunksize = 100_000
        matched_df_list = []

        offset = 0
        chunks = pd.read_csv(self.csv_path, chunksize=chunksize, dtype=str)
        for chunk in chunks:
            chunk.reset_index(drop=False, inplace=True)
            chunk["csv_idx"] = chunk["index"] + offset
            sub_chunk = chunk[usecols + ["csv_idx"]].copy()

            sub_chunk.dropna(subset=["subject", "relation", "object"], inplace=True)

            if exact_relation:
                temp_df = sub_chunk[sub_chunk["relation"] == relation_filter]
            else:
                temp_df = sub_chunk[
                    sub_chunk["relation"].str.contains(relation_filter, na=False)
                ]

            if object_filter:
                temp_df = temp_df[
                    temp_df["object"].str.contains(object_filter, na=False)
                ]

            if not temp_df.empty:
                matched_df_list.append(temp_df)

            offset += len(chunk)

        if matched_df_list:
            final_df = pd.concat(matched_df_list, ignore_index=True).drop_duplicates()
        else:
            final_df = pd.DataFrame(columns=["subject", "relation", "object", "csv_idx"])

        return final_df

    def get_all_triples_for_subject(self, subject_str: str) -> pd.DataFrame:
        """
        获取给定subject在CSV中出现的所有三元组，并保留csv_idx。
        """
        usecols = ["subject", "relation", "object"]
        chunksize = 100_000
        matched_df_list = []

        offset = 0
        chunks = pd.read_csv(self.csv_path, chunksize=chunksize, dtype=str)
        for chunk in chunks:
            chunk.reset_index(drop=False, inplace=True)
            chunk["csv_idx"] = chunk["index"] + offset
            sub_chunk = chunk[usecols + ["csv_idx"]].copy()

            sub_chunk.dropna(subset=["subject", "relation", "object"], inplace=True)
            temp_df = sub_chunk[sub_chunk["subject"] == subject_str]
            if not temp_df.empty:
                matched_df_list.append(temp_df)

            offset += len(chunk)

        if matched_df_list:
            final_df = pd.concat(matched_df_list, ignore_index=True).drop_duplicates()
        else:
            final_df = pd.DataFrame(columns=["subject", "relation", "object", "csv_idx"])

        return final_df

    def build_subgraph_from_df(self, sub_df: pd.DataFrame) -> nx.DiGraph:
        g_sub = nx.DiGraph()
        for _, row in sub_df.iterrows():
            s = row["subject"]
            r = row["relation"]
            o = row["object"]
            g_sub.add_node(s)
            g_sub.add_node(o)
            g_sub.add_edge(s, o, relation=r)
        return g_sub

    def get_full_data_for_subject(self, subject_str: str) -> pd.DataFrame:
        """
        返回CSV中所有 subject==subject_str 的完整记录(不仅 subject, relation, object)，
        并保留 csv_idx 以便后续英文行查找。
        """
        chunksize = 100_000
        matched_df_list = []

        offset = 0
        chunks = pd.read_csv(self.csv_path, chunksize=chunksize, dtype=str)
        for chunk in chunks:
            chunk.reset_index(drop=False, inplace=True)
            chunk["csv_idx"] = chunk["index"] + offset

            temp_df = chunk[chunk["subject"] == subject_str].copy()
            if not temp_df.empty:
                matched_df_list.append(temp_df)

            offset += len(chunk)

        if matched_df_list:
            final_df = pd.concat(matched_df_list, ignore_index=True).drop_duplicates()
        else:
            final_df = pd.DataFrame()

        return final_df


# --------------------- 4. Prompts & Functions for TCM Keywords Extraction ---------------------
KEYWORD_SYSTEM_PROMPT = """1. 【角色设定】 你是一位资深的食药同源中医专家，拥有丰富的中医理论知识与实践经验。
2. 【分析目标】   当用户提出与健康、养生或身体不适相关的问题时，你需要结合中医整体观念，为其提供可能的调理方向。
3. 【信息采集】   - 从用户的描述中，获取主要症状、生活习惯、作息规律、情绪状况等信息。
   - 对这些信息进行中医角度的初步分析与归纳。
4. 【关键词输出规则】
   - 请仅输出针对该问题的中医关键调理词，每个关键词严格为两个汉字。
   - 关键词之间使用圆括号分隔，不要添加多余文字或解释。
   - 请输出 10 个关键词，用于表示多种可能的调理方向（例如“疏肝”“理气”“清热”“补肾”等）。
5. 【回答格式】
   - 在最终回答中，务必只出现形如 (关键词) 的格式，每个关键词仅有两个汉字。
   - 例如：(疏肝)(理气)(健脾)(安神)(活血)(化痰)(益气)(补血)(清热)(滋阴)
6. 【关键词示例】
   以下列举 10 个可能用到的中医调理关键词，请根据具体情况选择或调整：
   (疏肝)(理气)(健脾)(补肾)(滋阴)(清热)(活血)(解郁)(安神)(化痰)
7. 【注意事项】
   - 请避免冗长的解释，尽量保持简洁。
   - 若涉及严重病症，应提示用户及时就医。
   - 不夸大疗效，保持专业与谨慎。
8. 【示例输出】
   用户问题示例：“我最近老是失眠，睡不踏实，还总做梦，该怎么调理？”
   输出示例：“(疏肝)(安神)(解郁)(理气)(补肾)(健脾)(清热)(活血)(滋阴)(化痰)”
仅在完成分析后输出 10 个两字关键词(如上所示)，彼此以圆括号区分，中间无其他文字或符号。
"""

def extract_keywords(user_question: str) -> list:
    messages = [
        {"role": "system", "content": KEYWORD_SYSTEM_PROMPT},
        {
            "role": "user",
            "content": f"用户提问：{user_question}\n请输出10个关键词，形如(疏肝)(理气)...",
        },
    ]
    try:
        response = openai.ChatCompletion.create(
            engine=deployment, messages=messages, temperature=0.0, max_tokens=200
        )
        raw_text = response.choices[0].message.content.strip()
    except Exception:
        return []
    pattern = r"\(([一-龥]{2})\)"
    matches = re.findall(pattern, raw_text)
    return matches


# --------------------- 5. Prompt & Function for Final Explanation (Chinese) ---------------------
MODERN_STYLE_SYSTEM_PROMPT = r"""你是一位专业营养师和医学顾问，但请勿显式提及任何传统中医概念或用语。你需要从现代医学、全球化饮食与营养学的角度，为用户给出专业又通俗易懂的建议。你已获得以下信息：
1. 用户最初提出的健康/症状问题
2. 你提炼出的 10 个关键功效关键词（源于内部参考，不要暴露中医体系或概念）
3. 你为用户推荐的 3 道食谱，以及每个食谱包含的功效、食材等知识点

请你基于以上信息，为用户生成一个**第一人称**、篇幅适中且逻辑清晰的回答，具体要求如下：

- **行文基于现代医学与营养学**：可引用适当的营养成分、健康建议，但避免出现类似“中医”“经络”“阴阳”“气血”等词汇。
- **前 2~3 段**：用现代医学视角梳理用户所描述的症状，并结合你“内部掌握”的 10 个关键词，给出简明的健康建议或思路。但关键词只用于内部推理，不要显式向用户展示。
- **食谱展示**：用 Markdown 语法展示 3 道推荐菜，采用 `### 菜名` 的标题格式。每道菜下可分 1~2 段说明其营养成分、主要功效，以及简要做法。
- **风格**：避免过多分点，注重行文连贯；不必强调其“中医”来源，也不要说明提炼关键词的过程。
- **结束处**：简要提示用户保持均衡饮食、必要时就医，但不做诊断承诺。
- **最后**：务必使用 Markdown 代码块（```markdown）包裹整体回答，如下所示：
  ```markdown
  你的文字回答内容……
  ```
  这样用户在前端可直接渲染为一篇带格式的内容。

注意：回答中不要暴露你内部处理过程或中医概念；只需以现代医学与营养学的通用语言进行表述。
"""

def generate_final_explanation(
    user_question: str, keywords: list, recommended_names: list, subgraph_texts: list
) -> str:
    """
    recommended_names: 最终要给用户展示的3道菜的名字(确保和CSV文件里一致)。
    subgraph_texts: 构建子图以便给GPT作为参考。
    """
    combined_subgraphs = "\n\n".join(subgraph_texts)
    # 在prompt中明确列出这3道菜
    recommended_str = "\n".join(
        f"{i+1}. {name}" for i, name in enumerate(recommended_names)
    )

    user_content = f"""\
[用户原问题]
{user_question}

[内部关键词(勿向用户展示)]
{keywords}

[推荐菜谱(需要与最终CSV一致)]
{recommended_str}

[知识图谱(内部参考)]
{combined_subgraphs}
"""
    messages = [
        {"role": "system", "content": MODERN_STYLE_SYSTEM_PROMPT},
        {"role": "user", "content": user_content},
    ]
    try:
        response = openai.ChatCompletion.create(
            engine=deployment, messages=messages, temperature=0.2, max_tokens=1200
        )
        final_answer = response.choices[0].message.content.strip()
    except Exception:
        final_answer = "对不起，生成回答时发生错误。"
    return final_answer


# --------------------- 6. Translation if mostly English ---------------------
TRANSLATION_SYSTEM_PROMPT = """You are a professional English translator.
Please translate the following Chinese text (including any Markdown code blocks) into clear, coherent English.
Maintain the Markdown formatting and code blocks.
"""

def translate_to_english(chinese_text: str) -> str:
    try:
        response = openai.ChatCompletion.create(
            engine=deployment,
            messages=[
                {"role": "system", "content": TRANSLATION_SYSTEM_PROMPT},
                {"role": "user", "content": chinese_text},
            ],
            temperature=0.0,
            max_tokens=1000,
        )
        eng_text = response.choices[0].message.content.strip()
        return eng_text
    except Exception:
        return "Sorry, translation error occurred."


# --------------------- 7. Save CSV for top 3 recommended recipes ---------------------
def clear_old_kg_files():
    """
    在将新推荐菜谱写入 KG1.csv, KG2.csv, KG3.csv 之前，
    先删除旧的这三个文件（若存在）。
    """
    for i in range(1, 4):
        fname = f"KG{i}.csv"
        if os.path.exists(fname):
            os.remove(fname)

def self_save_full_subject_csv(
    nutri_kg, subject_name: str, rank_id: int, is_english: bool = False
) -> (pd.DataFrame, str):
    """
    读取 subject_name 对应的所有行 (包括csv_idx)，若is_english，则获取该行+1处(若存在)的英文行。
    返回 (最终DataFrame, 最终展示名称display_name)：
       - DataFrame: 已写入的那道菜所有行
       - display_name: 要给用户展示(回答中用)的菜名
    """
    full_df = nutri_kg.get_full_data_for_subject(subject_name)
    if full_df.empty:
        return full_df, subject_name  # 没找到就还是返回原名

    display_name = subject_name  # 默认用中文名
    if is_english:
        # 尝试读取CSV并找英文版subject
        all_data = pd.read_csv(nutri_kg.csv_path, dtype=str)
        all_data.reset_index(drop=False, inplace=True)  # index是0~N
        # 英文行
        new_df_list = []
        for _, row in full_df.iterrows():
            real_idx = row["csv_idx"]
            english_row_idx = real_idx + 1
            sub_row = all_data[all_data["index"] == english_row_idx]
            if not sub_row.empty:
                new_df_list.append(sub_row.drop(columns=["index"]))
        if new_df_list:
            english_full_df = pd.concat(new_df_list, ignore_index=True).drop_duplicates()
            if not english_full_df.empty:
                # 取第一条行中的 subject 作为展示用
                disp_subj_series = english_full_df["subject"].dropna().unique()
                if len(disp_subj_series) > 0:
                    display_name = disp_subj_series[0]
            full_df = english_full_df  # 以英文版记录覆盖

    filename = f"KG{rank_id}.csv"
    full_df.to_csv(filename, index=False, encoding="utf-8-sig")
    return full_df, display_name


# --------------------- 8. Multi-round History and Main Chat Loop ---------------------
def append_history(round_id: int, record_type: str, content: str):
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    new_data = pd.DataFrame(
        [{"round": round_id, "type": record_type, "content": content, "time": now_str}]
    )
    new_data.to_csv(
        HISTORY_CSV, mode="a", header=False, index=False, encoding="utf-8-sig"
    )

def load_latest_round():
    if not os.path.exists(HISTORY_CSV):
        return 0
    df = pd.read_csv(HISTORY_CSV, encoding="utf-8-sig")
    if df.empty:
        return 0
    return df["round"].max()

def detect_language(user_text: str) -> bool:
    """
    若英文字符比中文字符更多，则判定为英文输入。
    """
    en_count = len(re.findall(r"[A-Za-z]", user_text))
    zh_count = len(re.findall(r"[\u4E00-\u9FFF]", user_text))
    return en_count > zh_count

def get_top50_subjects(df: pd.DataFrame) -> list:
    if df.empty:
        return []
    counts_series = df["subject"].value_counts()
    subject_counts = list(counts_series.items())
    subject_counts.sort(key=lambda x: x[1], reverse=True)
    top_subs = [item[0] for item in subject_counts[:50]]
    return top_subs


def do_new_round(user_text: str, nutrition_kg: NutritionKG):
    """
    普通的新问题处理：根据提问提取10个关键词，再搜索匹配的食谱功效，并输出Top3。
    保证回答与KG文件中的菜谱对齐。
    """
    round_id = load_latest_round() + 1

    # 1) Extract TCM keywords
    keywords = extract_keywords(user_text)

    # 2) Searching by "食谱的功效"
    result_dfs = []
    for kw in keywords:
        sub_df = nutrition_kg.advanced_search(
            "食谱的功效", object_filter=kw, exact_relation=True
        )
        if not sub_df.empty:
            result_dfs.append(sub_df)
    if result_dfs:
        final_df = pd.concat(result_dfs, ignore_index=True).drop_duplicates()
    else:
        final_df = pd.DataFrame(columns=["subject", "relation", "object", "csv_idx"])

    # 取出现频次最多的前50道菜，并从中选取前3
    top_50 = get_top50_subjects(final_df)
    top_3 = top_50[:3]

    # 构建子图文本
    subgraph_texts = []
    # 清空旧KG文件
    clear_old_kg_files()

    is_eng = detect_language(user_text)
    display_names = []  # 用于存储最终要给用户展示的菜名

    # 保存三道菜到 KG 文件，并获取各自的 "display_name"
    for i, subj in enumerate(top_3, start=1):
        # 取到英文或中文的对应行
        full_df, disp_name = self_save_full_subject_csv(
            nutrition_kg, subj, i, is_english=is_eng
        )
        display_names.append(disp_name)

        # 用中文的 subject_str 来获取完整子图（因为CSV里中文subject才是主键）
        # 但若你CSV本身就有英文subject是另一行，也可以改成 disp_name。
        # 这里为了子图正确，我们仍使用 subj(中文行)做子图构建：
        subj_df = nutrition_kg.get_all_triples_for_subject(subj)
        g_sub = nutrition_kg.build_subgraph_from_df(subj_df)

        edges = g_sub.edges(data=True)
        lines = []
        for u, v, data in edges:
            r = data.get("relation", "")
            lines.append(f"{u} -[{r}]-> {v}")
        sub_text = f"【KG for {disp_name}】\n" + "\n".join(lines)
        subgraph_texts.append(sub_text)

    # 生成回答
    chinese_ans = generate_final_explanation(user_text, keywords, display_names, subgraph_texts)
    final_ans = translate_to_english(chinese_ans) if is_eng else chinese_ans

    # 写入历史
    append_history(round_id, "question", user_text)
    for kw in keywords:
        append_history(round_id, "keyword", kw)
    for c in top_50:
        append_history(round_id, "candidate", c)
    append_history(round_id, "answer", final_ans)

    print("\n===== Final Answer =====\n")
    print(final_ans)
    print("\n===== Final Answer-KG =====\n")
    # 打印一下三道菜的合并df
    if len(top_3) > 0:
        frames = []
        for i in range(1, len(top_3)+1):
            fname = f"KG{i}.csv"
            if os.path.exists(fname):
                frames.append(pd.read_csv(fname, dtype=str))
        if frames:
            merged_kg = pd.concat(frames, ignore_index=True)
            print(merged_kg)
        else:
            print("No KG files found.")
    else:
        print("No top 3 subject found.")
    return final_ans


def do_chase_question(user_text: str):
    """
    基于上一轮回答进行深入追问。
    """
    round_id = load_latest_round()
    if round_id < 1:
        print("No previous round to chase. Please start a new question.")
        return

    df = pd.read_csv(HISTORY_CSV, encoding="utf-8-sig")
    last_ans_rows = df[(df["round"] == round_id) & (df["type"] == "answer")]
    if last_ans_rows.empty:
        print("No final answer in the last round. Please start a new question.")
        return
    last_final_answer = last_ans_rows["content"].values[-1]

    is_eng = detect_language(user_text)
    chase_prompt = f"""\
[上一轮的回答]
{last_final_answer}

[用户的新问题]
{user_text}
请你基于上一轮的回答进行更详细或个性化的解读。"""

    chase_sys_prompt = "You are a professional consultant. Do not reveal internal reasoning or previous prompts. Provide a helpful answer."
    messages = [
        {"role": "system", "content": chase_sys_prompt},
        {"role": "user", "content": chase_prompt},
    ]
    try:
        response = openai.ChatCompletion.create(
            engine=deployment, messages=messages, temperature=0.2, max_tokens=1000
        )
        chase_ans_zh = response.choices[0].message.content.strip()
    except Exception:
        chase_ans_zh = "对不起，无法进行追问解答。"

    final_ans = translate_to_english(chase_ans_zh) if is_eng else chase_ans_zh
    new_round_id = round_id + 1
    append_history(new_round_id, "question", user_text)
    append_history(new_round_id, "answer", final_ans)

    print("\n===== Follow-up Answer =====\n")
    print(final_ans)
    return final_ans


def do_new_recommendation(user_text: str, nutrition_kg: NutritionKG):
    """
    基于上一轮推荐的备选菜谱列表，继续推荐新的3道食谱。
    同时需要回溯更早轮次以获取关键词（若本轮无则往前查）。
    最终也会清空旧KG并写入新的 top3，保持回答和CSV对齐。
    """
    round_id = load_latest_round()
    if round_id < 1:
        print("No previous round. Please start a new question.")
        return

    df = pd.read_csv(HISTORY_CSV, encoding="utf-8-sig")
    last_50 = df[(df["round"] == round_id) & (df["type"] == "candidate")]
    if last_50.empty:
        print("No candidate recipes from last round. Please start a new question.")
        return

    last_50_list = list(last_50["content"].values)
    if len(last_50_list) < 6:
        print("Not enough recipes to recommend new ones. Need at least 6 from last round.")
        return

    # 回溯查询关键功效关键词
    tmp_r = round_id
    kw_df = df[(df["round"] == tmp_r) & (df["type"] == "keyword")]
    while tmp_r > 0 and kw_df.empty:
        tmp_r -= 1
        kw_df = df[(df["round"] == tmp_r) & (df["type"] == "keyword")]
    if kw_df.empty:
        print("No TCM keywords found in any previous round.")
        return
    old_keywords = list(kw_df["content"].values)

    new_3 = last_50_list[3:6]

    # 清空旧KG文件
    clear_old_kg_files()

    is_eng = detect_language(user_text)
    display_names = []
    subgraph_texts = []

    # 构建子图文本 & 保存 CSV
    for i, subj in enumerate(new_3, start=1):
        full_df, disp_name = self_save_full_subject_csv(
            nutrition_kg, subj, i, is_english=is_eng
        )
        display_names.append(disp_name)

        # 构建子图(注意: 这里为了匹配内部关系, 依旧使用中文版本subject subj)
        subj_df = nutrition_kg.get_all_triples_for_subject(subj)
        g_sub = nutrition_kg.build_subgraph_from_df(subj_df)
        edges = g_sub.edges(data=True)
        lines = []
        for u, v, data in edges:
            r = data.get("relation", "")
            lines.append(f"{u} -[{r}]-> {v}")
        sub_text = f"【KG for {disp_name}】\n" + "\n".join(lines)
        subgraph_texts.append(sub_text)

    # 获取上一轮(或更早)用户问题
    q_df = df[(df["round"] == round_id) & (df["type"] == "question")]
    tmp_qr = round_id
    while tmp_qr > 0 and q_df.empty:
        tmp_qr -= 1
        q_df = df[(df["round"] == tmp_qr) & (df["type"] == "question")]

    if q_df.empty:
        old_question_text = "No question found from any round."
    else:
        old_question_text = q_df["content"].values[0]

    combined_question = f"{old_question_text}\n(用户补充需求: {user_text})"
    zh_ans = generate_final_explanation(combined_question, old_keywords, display_names, subgraph_texts)

    final_ans = translate_to_english(zh_ans) if is_eng else zh_ans

    new_round_id = round_id + 1
    append_history(new_round_id, "question", user_text)
    append_history(new_round_id, "answer", final_ans)

    print("\n===== New 3-Recipe Recommendation Answer =====\n")
    print(final_ans)
    return final_ans


def do_include_exclude(user_text: str, nutrition_kg: NutritionKG):
    """
    解析用户传入的JSON {"include": [...], "exclude": [...]}
    - 回溯以获取上一轮或更早轮的10个功效关键词
    - 搜索所有满足这些关键词的食谱
    - 分步处理 include 和 exclude 并可视化每一步数量变化
    - 最终取前3个推荐，清空旧KG文件并保存新的，同时在回答中保持菜名和CSV一致
    """
    round_id = load_latest_round()
    if round_id < 1:
        print("No previous round. Please start a new question.")
        return

    try:
        data = json.loads(user_text)
        include_ings = data.get("include", [])
        exclude_ings = data.get("exclude", [])
    except:
        print("Invalid JSON format for include/exclude.")
        return

    df_hist = pd.read_csv(HISTORY_CSV, encoding="utf-8-sig")

    # 回溯获取关键词
    tmp_r = round_id
    kw_df = df_hist[(df_hist["round"] == tmp_r) & (df_hist["type"] == "keyword")]
    while tmp_r > 0 and kw_df.empty:
        tmp_r -= 1
        kw_df = df_hist[(df_hist["round"] == tmp_r) & (df_hist["type"] == "keyword")]
    if kw_df.empty:
        print("No TCM keywords found in any previous round.")
        return
    old_keywords = list(kw_df["content"].values)

    # 1) 使用旧关键词搜索所有食谱
    result_dfs = []
    for kw in old_keywords:
        sub_df = nutrition_kg.advanced_search(
            "食谱的功效", object_filter=kw, exact_relation=True
        )
        if not sub_df.empty:
            result_dfs.append(sub_df)
    if result_dfs:
        final_df = pd.concat(result_dfs, ignore_index=True).drop_duplicates()
    else:
        final_df = pd.DataFrame(columns=["subject", "relation", "object", "csv_idx"])

    if final_df.empty:
        print("No recipes match the previous keywords. Cannot apply include/exclude.")
        return

    candidate_subjects = set(final_df["subject"].unique().tolist())

    # 一次性查出所有 '食谱的食材构成'
    ing_df = nutrition_kg.advanced_search("食谱的食材构成", None, True)

    print("\n=== 分步处理 include 条件 ===")
    for ing in include_ings:
        has_ing_set = set(ing_df[ing_df["object"] == ing]["subject"])
        candidate_subjects = candidate_subjects.intersection(has_ing_set)
        print(f"包含食材 '{ing}' 后，剩余可选菜数量: {len(candidate_subjects)}")
        if not candidate_subjects:
            print("已经没有满足所有 include 条件的菜谱了。")
            break

    if not candidate_subjects:
        print("\n=== 最终搜索结果为空 ===")
        return

    print("\n=== 分步处理 exclude 条件 ===")
    for ing in exclude_ings:
        has_ing_set = set(ing_df[ing_df["object"] == ing]["subject"])
        new_candidates = candidate_subjects.difference(has_ing_set)
        print(f"排除含食材 '{ing}' 后，剩余可选菜数量: {len(new_candidates)}")
        candidate_subjects = new_candidates
        if not candidate_subjects:
            print("已经没有满足 exclude 条件后的菜谱了。")
            break

    if not candidate_subjects:
        print("\n=== 最终搜索结果为空 ===")
        return

    # 排序并选前3
    sub_filtered_df = final_df[final_df["subject"].isin(candidate_subjects)]
    count_series = sub_filtered_df["subject"].value_counts()
    sorted_subjects = list(count_series.index)
    top_3 = sorted_subjects[:3]
    if not top_3:
        print("No recipes left after filtering.")
        return

    # 清空旧KG文件
    clear_old_kg_files()

    is_eng = detect_language(user_text)
    display_names = []
    subgraph_texts = []

    for i, subj in enumerate(top_3, start=1):
        full_df, disp_name = self_save_full_subject_csv(
            nutrition_kg, subj, i, is_english=is_eng
        )
        display_names.append(disp_name)

        subj_df = nutrition_kg.get_all_triples_for_subject(subj)
        g_sub = nutrition_kg.build_subgraph_from_df(subj_df)
        edges = g_sub.edges(data=True)
        lines = []
        for u, v, data in edges:
            r = data.get("relation", "")
            lines.append(f"{u} -[{r}]-> {v}")
        sub_text = f"【KG for {disp_name}】\n" + "\n".join(lines)
        subgraph_texts.append(sub_text)

    explanation_text = (
        f"用户要求包含食材: {include_ings}, 排除食材: {exclude_ings}。\n"
        f"这是基于上一轮关键词 {old_keywords} 过滤后的结果：\n"
    )
    zh_ans = generate_final_explanation(explanation_text, old_keywords, display_names, subgraph_texts)
    final_ans = translate_to_english(zh_ans) if is_eng else zh_ans

    new_round_id = round_id + 1
    append_history(new_round_id, "question", user_text)
    append_history(new_round_id, "answer", final_ans)

    print("\n===== Include/Exclude Filtered Recipes =====\n")
    print(final_ans)
    print("\n===== Final Answer-KG =====\n")
    # 打印一下结果CSV
    frames = []
    for i in range(1, len(top_3)+1):
        fname = f"KG{i}.csv"
        if os.path.exists(fname):
            frames.append(pd.read_csv(fname, dtype=str))
    if frames:
        merged_kg = pd.concat(frames, ignore_index=True)
        print(merged_kg)
    else:
        print("No KG files found.")

    return final_ans


def main():
    print("=== Multi-turn interactive system ===")
    print("Type 'exit' to quit at any time.")

    init_history_file()
    nutrition_kg = NutritionKG(CSV_PATH)

    while True:
        user_text = input("\nPlease enter your question (or follow-up): ").strip()
        if user_text.lower() == "exit":
            print("Shutting down.")
            break

        # 若能成功以 JSON 形式解析到 include / exclude，则走 do_include_exclude 分支
        is_json_input = False
        try:
            test_data = json.loads(user_text)
            if ("include" in test_data) or ("exclude" in test_data):
                is_json_input = True
        except:
            pass

        if is_json_input:
            do_include_exclude(user_text, nutrition_kg)
        elif "chase" in user_text.lower():
            do_chase_question(user_text)
        elif "new" in user_text.lower():
            do_new_recommendation(user_text, nutrition_kg)
        else:
            do_new_round(user_text, nutrition_kg)


if __name__ == "__main__":
    main()
