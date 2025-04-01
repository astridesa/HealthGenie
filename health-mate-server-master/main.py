from flask import Flask, jsonify, request
import openai
import os
import re
import pandas as pd
from flask_cors import CORS
import csv


from nutrition import NutritionKG

nutrition_kg = NutritionKG()

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

KEYWORD_SYSTEM_PROMPT = """You are an assistant dedicated to extracting keywords related to nutrition or ingredients from the user's query. Please maintain the following instructions and ensure your responses adhere to them:
- Focus on identifying keywords connected to nutrition, ingredient names, health benefits, or other relevant aspects of dietary information.
- If multiple distinct keywords are present, separate them using commas or new lines. Do not use the Chinese symbol "、" for separation.
- If you cannot accurately identify the keywords, please provide your best possible suggestions.
- All textual outputs in this process must be presented in Chinese (简体中文).
"""

FINAL_ANSWER_SYSTEM_PROMPT = """You are a nutrition consultant. Please utilize the given knowledge graph (triple) information, along with the user's question, to provide an answer according to the following requirements:
- Base your response as much as possible on the known triple information from the knowledge graph, answering in a concise manner.
- If the provided information is insufficient for a complete answer, please state your uncertainty explicitly.
- All final answers should be written in English, and you should avoid any unnecessary elaboration.
"""


def extract_keywords(
    user_question: str, system_prompt: str = KEYWORD_SYSTEM_PROMPT
) -> list:
    chat_prompt = [
        {"role": "system", "content": system_prompt},
        {
            "role": "user",
            "content": f"user question：{user_question}\n please output important keywords in English",
        },
    ]
    try:
        response = openai.ChatCompletion.create(
            engine=deployment,  # Azure OpenAI 通常用 engine (或 deployment_name)
            messages=chat_prompt,
            max_tokens=200,
            temperature=0.0,
        )
        raw_text = response["choices"][0]["message"]["content"].strip()
    except Exception as e:
        print(e)
        return []

    # 將「、」「；」「;」等替換成逗號，再用正則分割
    replaced_text = re.sub(r"[、；;]", ",", raw_text)
    tokens = re.split(r"[,\s\n]+", replaced_text)
    keywords = [t.strip() for t in tokens if t.strip()]

    return keywords


def search_in_kg(kg: NutritionKG, keywords: list) -> dict:
    matched_df_list = []
    for kw in keywords:
        df_sub = kg.search_by_subject(kw, exact=False)
        df_obj = kg.search_by_object(kw, exact=False)
        df_rel = kg.search_by_relation(kw, exact=False)

        if not df_sub.empty:
            matched_df_list.append(df_sub)
        if not df_obj.empty:
            matched_df_list.append(df_obj)
        if not df_rel.empty:
            matched_df_list.append(df_rel)

    if matched_df_list:
        final_df = pd.concat(matched_df_list).drop_duplicates().reset_index(drop=True)
    else:
        final_df = pd.DataFrame(columns=["subject", "relation", "object"])

    g_sub = kg.get_subgraph_from_df(final_df)
    node_list = list(g_sub.nodes())
    edge_list = [
        (u, v, data.get("relation")) for (u, v, data) in g_sub.edges(data=True)
    ]

    return {"nodes": node_list, "edges": edge_list, "matches_df": final_df}


def generate_final_answer(
    user_question: str,
    triple_df: pd.DataFrame,
    system_prompt: str = FINAL_ANSWER_SYSTEM_PROMPT,
) -> str:
    # 整理知識圖譜
    if triple_df.empty:
        knowledge_text = "查無相關的知識圖譜資訊。"
    else:
        triple_lines = [
            f"({row['subject']} - {row['relation']} - {row['object']})"
            for _, row in triple_df.iterrows()
        ]
        knowledge_text = "\n".join(triple_lines)

    chat_prompt = [
        {"role": "system", "content": system_prompt},
        {
            "role": "user",
            "content": f"""用户提出的食谱相关的问题是：{user_question}

                        从我们自己构建的养生食谱数据库中为搜索到了以下以三元组形式存储的数据内容：
                        {knowledge_text}

                        请你基于上面的搜索得到的食谱条目进行回答；若搜索得到的内容不足以支撑对应的回答，请你基于自己的知识，推断用户提问的意图，并作出言之有理的恰当回答。
                        """,
        },
    ]

    try:
        response = openai.ChatCompletion.create(
            engine=deployment, messages=chat_prompt, max_tokens=600, temperature=0.2
        )
        final_answer = response["choices"][0]["message"]["content"].strip()
        return final_answer
    except Exception as e:
        return f"在生成回答时遇到错误：{str(e)}"


app = Flask(__name__)

CORS(
    app,
    resources={
        r"/*": {
            "origins": ["http://localhost:3000", "http://localhost:5001"],
            "methods": ["GET", "POST", "OPTIONS"],
            "allow_headers": ["Content-Type", "Authorization", "Accept"],
            "supports_credentials": True,
        }
    },
)

history_csv_path = "./history.csv"

if not os.path.exists(history_csv_path):
    with open(history_csv_path, mode="w", newline="", encoding="utf-8") as file:
        writer = csv.writer(file)
        writer.writerow(["id", "type", "content", "time"])


def write_history(history):
    id = history["id"]
    type = history["type"]
    content = history["content"]
    time = history["time"]
    with open(history_csv_path, mode="a", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)

        writer.writerow([id, type, content, time])


@app.route("/", methods=["GET"])
def index():
    return jsonify({"message": "成功了"})


@app.route("/api/history", methods=["POST"])
def write_click_history():
    try:
        data = request.get_json()
        print("Received data:", data)  # Debug log

        id = data.get("id", "")
        content = data.get("content", "")
        type = data.get("type", "click")  # Default to 'click' if not specified
        time = data.get("time", "")

        print(
            f"Writing history: id={id}, type={type}, content={content}, time={time}"
        )  # Debug log

        write_history(
            {
                "id": id,
                "content": content,
                "type": type,  # Now accepts any type, including 'include' and 'exclude'
                "time": time,
            }
        )
        return jsonify({"message": "记录成功"})
    except Exception as e:
        print("Error in write_click_history:", str(e))  # Error log
        return jsonify({"error": str(e)}), 500


@app.route("/api/recommend", methods=["POST"])
def recommend():
    data = request.get_json()

    nodeName = data.get("nodeName", "")
    type = data.get("type", "")

    finalAnswer = f"The recipe that {type} {nodeName} is aaa"
    recommendQuery = f"The recommend query is"

    return jsonify({"finalAnswer": finalAnswer, "recommendQuery": recommendQuery})


@app.route("/api/question", methods=["POST"])
def answer_question():
    data = request.get_json()

    history = data.get("history", {})

    question = data.get("question", "")

    clicked_node = data.get("clickedNode", {})

    write_history(history)

    print(clicked_node)

    keywords = extract_keywords(question, KEYWORD_SYSTEM_PROMPT)

    search_result = search_in_kg(nutrition_kg, keywords)

    final_answer = generate_final_answer(question, search_result["matches_df"])

    return jsonify(
        {
            "keywords": keywords,
            "searchResult": search_result["nodes"],
            "finalAnswer": final_answer,
        }
    )


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5001, debug=True)
