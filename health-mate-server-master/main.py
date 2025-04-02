from flask import Flask, jsonify, request
import openai
import os
import re
import pandas as pd
from flask_cors import CORS
import csv
import logging
import traceback

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
            "methods": ["GET", "POST", "DELETE", "OPTIONS"],
            "allow_headers": ["Content-Type", "Authorization", "Accept"],
            "supports_credentials": True,
        }
    },
)

# Set up logging
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

# Get absolute path for history.csv
current_dir = os.path.dirname(os.path.abspath(__file__))
history_csv_path = os.path.join(current_dir, "history.csv")
logger.info(f"Server started. Current directory: {current_dir}")
logger.info(f"History CSV path: {history_csv_path}")

# Ensure history.csv exists with proper headers
if not os.path.exists(history_csv_path):
    try:
        with open(history_csv_path, mode="w", newline="", encoding="utf-8") as file:
            writer = csv.writer(file)
            writer.writerow(["id", "type", "content", "time"])
        logger.info(f"Created new history.csv at {history_csv_path}")
    except Exception as e:
        logger.error(f"Failed to create history.csv: {str(e)}")
        raise
else:
    logger.info(f"Found existing history.csv at {history_csv_path}")


def write_history(history):
    try:
        id = history["id"]
        type = history["type"]
        content = history["content"]
        time = history["time"]

        # Accept include/exclude/cancel/apply/chat operations
        if type not in ["include", "exclude", "cancel", "apply", "chat"]:
            logger.info(f"Skipping unsupported history type: type={type}")
            return

        logger.info(
            f"Writing operation to history.csv: id={id}, type={type}, content={content}"
        )

        # Check if file exists and is writable
        if not os.path.exists(history_csv_path):
            logger.error(f"history.csv does not exist at {history_csv_path}")
            raise FileNotFoundError(f"history.csv not found at {history_csv_path}")

        if not os.access(history_csv_path, os.W_OK):
            logger.error(f"No write permission for history.csv at {history_csv_path}")
            raise PermissionError(f"No write permission for {history_csv_path}")

        # For all operations, just append to the file
        with open(history_csv_path, mode="a", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            writer.writerow([id, type, content, time])

        logger.info("Successfully wrote to history.csv")
    except Exception as e:
        logger.error(f"Error writing to history.csv: {str(e)}")
        raise


def read_history_with_cancellations(user_id: str) -> list:
    """Read history and handle cancellations by removing cancelled include/exclude operations."""
    try:
        if not os.path.exists(history_csv_path):
            logger.error(f"history.csv does not exist at {history_csv_path}")
            return []

        # Read all records
        with open(history_csv_path, mode="r", newline="", encoding="utf-8") as file:
            reader = csv.reader(file)
            rows = list(reader)

        if not rows:
            return []

        # Skip header row
        history_rows = rows[1:]

        # Process rows in reverse to handle consecutive cancellations
        result = []
        skip_count = 0

        for row in reversed(history_rows):
            if row[0] == user_id:
                if row[1] == "cancel":
                    # Increment skip count for each cancel record
                    skip_count += 1
                    continue
                elif row[1] in ["include", "exclude"]:
                    if skip_count > 0:
                        # Skip this record if we have pending cancellations
                        skip_count -= 1
                        continue
                    # Format the row as a history item object
                    result.append(
                        {
                            "id": row[0],
                            "type": row[1],
                            "content": row[2],
                            "time": row[3],
                        }
                    )

        # Reverse back to chronological order
        return list(reversed(result))

    except Exception as e:
        logger.error(f"Error reading history with cancellations: {str(e)}")
        return []


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
        type = data.get("type", "")
        time = data.get("time", "")

        # Accept include/exclude/cancel/apply/chat operations
        if type not in ["include", "exclude", "cancel", "apply", "chat"]:
            logger.info(f"Rejecting non-operation type: {type}")
            return jsonify({"message": "Operation type not supported"}), 400

        # Only require content for include/exclude operations
        if type in ["include", "exclude"] and not content:
            logger.info("Rejecting empty content for include/exclude operation")
            return (
                jsonify(
                    {"message": "Content is required for include/exclude operations"}
                ),
                400,
            )

        print(
            f"Writing history: id={id}, type={type}, content={content}, time={time}"
        )  # Debug log

        write_history(
            {
                "id": id,
                "content": content,
                "type": type,
                "time": time,
            }
        )
        return jsonify({"message": "记录成功"})
    except Exception as e:
        print("Error in write_click_history:", str(e))  # Error log
        return jsonify({"error": str(e)}), 500


@app.route("/api/history", methods=["DELETE"])
def delete_last_history():
    try:
        data = request.get_json()
        user_id = data.get("id", "")
        current_time = data.get("time", "")

        logger.info(f"Attempting to delete last history for user: {user_id}")
        logger.info(f"Request data: {data}")
        logger.info(f"Request headers: {dict(request.headers)}")

        # Check if file exists and is writable
        if not os.path.exists(history_csv_path):
            logger.error(f"history.csv does not exist at {history_csv_path}")
            raise FileNotFoundError(f"history.csv not found at {history_csv_path}")

        if not os.access(history_csv_path, os.W_OK):
            logger.error(f"No write permission for history.csv at {history_csv_path}")
            raise PermissionError(f"No write permission for {history_csv_path}")

        # Read all records from history.csv
        with open(history_csv_path, mode="r", newline="", encoding="utf-8") as file:
            reader = csv.reader(file)
            rows = list(reader)

        logger.info(f"Read {len(rows)} rows from history.csv")
        logger.info(f"Last few rows: {rows[-5:]}")  # Log the last 5 rows

        # Find the last include/exclude record for this user
        last_operation_index = -1
        last_operation_type = ""
        last_operation_content = ""
        for i in range(len(rows) - 1, 0, -1):  # Skip header row
            if rows[i][0] == user_id and (
                rows[i][1] == "include" or rows[i][1] == "exclude"
            ):
                last_operation_index = i
                last_operation_type = rows[i][1]
                last_operation_content = rows[i][2]
                logger.info(f"Found last operation at index {i}: {rows[i]}")
                break

        if last_operation_index != -1:
            # Add a cancel record with the content of the deleted record
            cancel_record = [
                user_id,
                "cancel",
                f"{last_operation_type}-{last_operation_content}",
                current_time,
            ]
            rows.append(cancel_record)
            logger.info(f"Added cancel record: {cancel_record}")

            # Write back to file
            with open(history_csv_path, mode="w", newline="", encoding="utf-8") as file:
                writer = csv.writer(file)
                writer.writerows(rows)

            logger.info(f"Successfully updated history.csv. New row count: {len(rows)}")
            logger.info(
                f"Last few rows after update: {rows[-5:]}"
            )  # Log the last 5 rows after update
        else:
            logger.info("No matching record found to delete")

        return jsonify({"message": "删除成功"})
    except Exception as e:
        logger.error(f"Error in delete_last_history: {str(e)}")
        logger.error(f"Error type: {type(e)}")
        logger.error(f"Error traceback: {traceback.format_exc()}")
        return jsonify({"error": str(e)}), 500


@app.route("/api/history", methods=["GET"])
def get_history():
    try:
        user_id = request.args.get("id", "")
        if not user_id:
            return jsonify({"error": "User ID is required"}), 400

        history = read_history_with_cancellations(user_id)
        return jsonify({"history": history})
    except Exception as e:
        logger.error(f"Error getting history: {str(e)}")
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
    try:
        logger.info("Received question request")
        data = request.get_json()
        if not data:
            logger.error("No JSON data received")
            return jsonify({"error": "No JSON data received"}), 400

        question = data.get("question", "")
        if not question:
            logger.error("Empty question received")
            return jsonify({"error": "Question is required"}), 400

        clicked_node = data.get("clickedNode", None)
        logger.info(f"Processing question: {question}, clicked_node: {clicked_node}")

        # Extract keywords from the question
        try:
            keywords = extract_keywords(question)
            logger.info(f"Extracted keywords: {keywords}")
        except Exception as e:
            logger.error(f"Error extracting keywords: {str(e)}")
            logger.error(traceback.format_exc())
            return jsonify({"error": f"Failed to extract keywords: {str(e)}"}), 500

        # Search in knowledge graph
        try:
            search_result = search_in_kg(nutrition_kg, keywords)
            logger.info(f"Search result: {search_result}")
        except Exception as e:
            logger.error(f"Error searching knowledge graph: {str(e)}")
            logger.error(traceback.format_exc())
            return (
                jsonify({"error": f"Failed to search knowledge graph: {str(e)}"}),
                500,
            )

        # Generate final answer
        try:
            final_answer = generate_final_answer(question, search_result["matches_df"])
            logger.info(f"Generated answer: {final_answer}")
        except Exception as e:
            logger.error(f"Error generating final answer: {str(e)}")
            logger.error(traceback.format_exc())
            return jsonify({"error": f"Failed to generate answer: {str(e)}"}), 500

        # Convert DataFrame to list of dictionaries for JSON serialization
        matches_df = search_result["matches_df"]
        if not matches_df.empty:
            matches_data = matches_df.to_dict("records")
        else:
            matches_data = []

        return jsonify(
            {
                "finalAnswer": final_answer,
                "searchResult": {
                    "nodes": search_result["nodes"],
                    "edges": search_result["edges"],
                    "matches": matches_data,
                },
                "keywords": keywords,
            }
        )

    except Exception as e:
        logger.error(f"Unexpected error in answer_question: {str(e)}")
        logger.error(traceback.format_exc())
        return jsonify({"error": f"Unexpected error: {str(e)}"}), 500


def test_azure_connection():
    try:
        logger.info("Testing Azure OpenAI API connection...")
        logger.info(f"Using endpoint: {endpoint}")
        logger.info(f"Using deployment: {deployment}")
        logger.info(f"Using API version: {openai.api_version}")

        # Try a simple completion to test the connection
        response = openai.ChatCompletion.create(
            engine=deployment,
            messages=[
                {"role": "system", "content": "You are a helpful assistant."},
                {"role": "user", "content": "Hello, this is a test message."},
            ],
            max_tokens=10,
            temperature=0.0,
        )

        logger.info("Azure OpenAI API connection successful!")
        logger.info(f"Response: {response['choices'][0]['message']['content']}")
        return True
    except Exception as e:
        logger.error(f"Azure OpenAI API connection failed: {str(e)}")
        logger.error(f"Error type: {type(e)}")
        logger.error(f"Error traceback: {traceback.format_exc()}")
        return False


# Test connection when server starts
if __name__ == "__main__":
    if not test_azure_connection():
        logger.error(
            "Failed to connect to Azure OpenAI API. Server will start but API calls may fail."
        )
    app.run(host="0.0.0.0", port=5001, debug=True)
