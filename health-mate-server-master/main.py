from flask import Flask, jsonify, request
import openai
import json
import os
import re
import pandas as pd
from flask_cors import CORS
import csv
import logging
import traceback
import re
from pathlib import Path
from main_new import (
    do_new_recommendation,
    do_new_round,
    do_chase_question,
    init_history_file,
    do_include_exclude,
)


from main_new import NutritionKG

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


# def generate_final_answer(
#     user_question: str,
#     triple_df: pd.DataFrame,
#     system_prompt: str = FINAL_ANSWER_SYSTEM_PROMPT,
# ) -> str:
#     # 整理知識圖譜
#     if triple_df.empty:
#         knowledge_text = "查無相關的知識圖譜資訊。"
#     else:
#         triple_lines = [
#             f"({row['subject']} - {row['relation']} - {row['object']})"
#             for _, row in triple_df.iterrows()
#         ]
#         knowledge_text = "\n".join(triple_lines)

#     chat_prompt = [
#         {"role": "system", "content": system_prompt},
#         {
#             "role": "user",
#             "content": f"""用户提出的食谱相关的问题是：{user_question}

#                         从我们自己构建的养生食谱数据库中为搜索到了以下以三元组形式存储的数据内容：
#                         {knowledge_text}

#                         请你基于上面的搜索得到的食谱条目进行回答；若搜索得到的内容不足以支撑对应的回答，请你基于自己的知识，推断用户提问的意图，并作出言之有理的恰当回答。
#                         """,
#         },
#     ]

#     try:
#         response = openai.ChatCompletion.create(
#             engine=deployment, messages=chat_prompt, max_tokens=600, temperature=0.2
#         )
#         final_answer = response["choices"][0]["message"]["content"].strip()
#         return final_answer
#     except Exception as e:
#         return f"在生成回答时遇到错误：{str(e)}"


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

# Define paths
HISTORY_DIR = "history"
history_dir_path = Path(HISTORY_DIR)


def get_user_history_path(user_id: str) -> Path:
    """Get the path to a user's history file."""
    # Ensure history directory exists
    history_dir_path.mkdir(exist_ok=True)
    return history_dir_path / f"{user_id}.csv"


def write_history(history):
    try:
        id = history["id"]
        type = history["type"]
        content = history["content"]
        time = history["time"]

        # Accept include/exclude/cancel/apply/chat/recommendation operations
        if type not in [
            "include",
            "exclude",
            "cancel",
            "apply",
            "chat",
            "recommendation",
        ]:
            logger.info(f"Skipping unsupported history type: type={type}")
            return

        logger.info(
            f"Writing operation to user history file: id={id}, type={type}, content={content}"
        )

        # Get user's history file path
        user_history_path = get_user_history_path(id)

        # Create file with headers if it doesn't exist
        if not user_history_path.exists():
            with open(user_history_path, mode="w", newline="", encoding="utf-8") as f:
                writer = csv.writer(f)
                writer.writerow(["type", "content", "time"])

        # Append the new record
        with open(user_history_path, mode="a", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            writer.writerow([type, content, time])

        logger.info(f"Successfully wrote to {user_history_path}")
    except Exception as e:
        logger.error(f"Error writing to history file: {str(e)}")
        raise


def read_history_with_cancellations(user_id: str) -> list:
    """Read history and handle cancellations by removing cancelled include/exclude operations."""
    try:
        user_history_path = get_user_history_path(user_id)

        if not user_history_path.exists():
            logger.info(f"No history file found for user {user_id}")
            return []

        # Read all records
        with open(user_history_path, mode="r", newline="", encoding="utf-8") as file:
            reader = csv.reader(file)
            rows = list(reader)

        if not rows:
            logger.info(f"History file for user {user_id} is empty.")
            return []

        # Skip header row
        history_rows = rows[1:]
        # print(history_rows)
        # if not history_rows:
        #     logger.info(f"No history records found for user {user_id}.")
        #     return []

        # Process rows in reverse to handle consecutive cancellations
        result = []
        skip_count = 0

        for row in history_rows:
            # print("row")
            # print(row)
            # if row[0] == "cancel":
            #     # Increment skip count for each cancel record
            #     skip_count += 1
            #     continue
            # elif row[0] in ["include", "exclude"]:
            #     if skip_count > 0:
            #         # Skip this record if we have pending cancellations
            #         skip_count -= 1
            #         continue
            # Format the row as a history item object
            if len(row) == 3:
                result.append({"type": row[0], "content": row[1], "time": row[2]})
            # else:
            #     result.append({"type": row[0], "content": row[1]})

        # Reverse the result to get chronological order
        return result
    except Exception as e:
        logger.error(f"Error reading history file: {str(e)}")
        return []


@app.route("/", methods=["GET"])
def index():
    return jsonify({"message": "成功了"})


@app.route("/api/history", methods=["POST"])
def write_click_history():
    try:
        history = request.json
        write_history(history)
        return jsonify({"status": "success"})
    except Exception as e:
        logger.error(f"Error in write_click_history: {str(e)}")
        return jsonify({"status": "error", "message": str(e)}), 500


@app.route("/api/history", methods=["DELETE"])
def delete_last_history():
    try:
        user_id = request.json.get("id")
        if not user_id:
            return jsonify({"status": "error", "message": "No user ID provided"}), 400

        user_history_path = get_user_history_path(user_id)
        if not user_history_path.exists():
            return jsonify({"status": "error", "message": "No history found"}), 404

        # Read all records
        with open(user_history_path, mode="r", newline="", encoding="utf-8") as file:
            reader = csv.reader(file)
            rows = list(reader)

        if len(rows) <= 1:  # Only header row
            return jsonify({"status": "error", "message": "No history to delete"}), 404

        # Find the last include/exclude record from the end
        last_include_exclude_index = -1
        for i in range(len(rows) - 1, 0, -1):  # Skip header row
            if rows[i][0] in ["include", "exclude"]:  # Check type column
                last_include_exclude_index = i
                break

        if last_include_exclude_index == -1:
            return (
                jsonify(
                    {
                        "status": "error",
                        "message": "No include/exclude records to delete",
                    }
                ),
                404,
            )

        # Remove the last include/exclude record
        rows.pop(last_include_exclude_index)

        # Write back to file
        with open(user_history_path, mode="w", newline="", encoding="utf-8") as file:
            writer = csv.writer(file)
            writer.writerows(rows)

        return jsonify({"status": "success"})
    except Exception as e:
        logger.error(f"Error in delete_last_history: {str(e)}")
        return jsonify({"status": "error", "message": str(e)}), 500


@app.route("/api/history", methods=["GET"])
def get_history():
    try:
        user_id = request.args.get("id")
        if not user_id:
            return jsonify({"status": "error", "message": "No user ID provided"}), 400

        history = read_history_with_cancellations(user_id)
        return jsonify({"status": "success", "history": history})
    except Exception as e:
        logger.error(f"Error in get_history: {str(e)}")
        return jsonify({"status": "error", "message": str(e)}), 500


@app.route("/api/recommend", methods=["POST"])
def recommend():
    data = request.get_json()

    user_id = data.get("userId", "")
    user_history = read_chat_session_history(user_id)
    sys_prompt = "You are an expert in predicting user health consultation intentions, specializing in recipe recommendation systems. Your task is to analyze the user's interaction history and predict their current need, then generate an approriate open question."
    query_recommend_prompt = """
    
    ### Interaction History Format
    1. The system helps users find recipes through a knowledge graph interface where users can include/exclude ingredients.
    2. History records contain the following fields:
    - type: "include", "exclude", "recommend" means the recommendation query, "apply" means the user apply the recommendation, "chat" (both user messages and assistant responses)
    - content: The main text of the interaction
    - time: Timestamp of the interaction
    3. Conversations between user and assistant messages.
    ### Task Requirement:
    1. Carefully analyze the interaction history to understand the user's preferences and current intention.
    2. Generate proactively open question that aligns with their demonstrated preferences, meanwhile it also keep the question open and not limited to the history
    3. Match the output language (Chinese/English) to the user's conversation language.
    4. Format the output as plain text only.
    5. Use a proactive yet gentle tone in your recommendation.
    6. If no history exists, suggest a general recipe recommendation query.
    ### Output format
    1. Provide recommended query text with proactive tone, e.g. do you want to explore the recipe with xxx ingredients?
    2. Do not include any explanations or metadata
    ###
    The following is the user's interaction history:
    {interaction_history}

    Now please recommend the query based on user's preference and intention.
    """
    messages = [
        {"role": "system", "content": sys_prompt},
        {
            "role": "user",
            "content": query_recommend_prompt.format(
                interaction_history=json.dumps(
                    user_history, ensure_ascii=False, indent=4
                )
            ),
        },
    ]
    try:
        response = openai.ChatCompletion.create(
            engine=deployment, messages=messages, temperature=0.7, max_tokens=100
        )
        response = response.choices[0].message.content.strip()
    except:
        response = "Please recommend some healthy recipe."
    print(response)
    return jsonify({"recommendationQuery": response})


@app.route("/api/include_exclude", methods=["POST"])
def include_exclude():
    new_session_count = 0
    data = request.get_json()
    user_id = data.get("userId", "")
    user_history = read_history_with_cancellations(user_id)
    if user_history:
        new_session_count = sum(
            1
            for h in user_history
            if h["type"] == "chat" and h["content"] == "New chat session"
        )
    kg_llm_retrive_path = os.path.join(
        HISTORY_DIR, user_id + "_task" + str(new_session_count) + ".csv"
    )
    init_history_file(kg_llm_retrive_path)
    operation = read_operation_history(user_id)
    kg_results, final_answer = do_include_exclude(operation, nutrition_kg)
    if "```markdown" in final_answer:
        final_answer = re.sub(r"```markdown", "", final_answer)
        final_answer = re.sub(r"```", "", final_answer)
    knowledgeGraph = pandas_to_json(kg_results) if not kg_results.empty else None
    return jsonify({"finalAnswer": final_answer, "knowledgeGraph": knowledgeGraph})


@app.route("/api/question", methods=["POST"])
def answer_question():
    try:
        logger.info("Received question request")
        data = request.get_json()
        if not data:
            logger.error("No JSON data received")
            return jsonify({"error": "No JSON data received"}), 400

        question = data.get("question", "")
        user_id = data.get("userId", "")  # Get userId from request
        user_history = read_history_with_cancellations(user_id)
        if not question:
            logger.error("Empty question received")
            return jsonify({"error": "Question is required"}), 400

        logger.info(f"Processing question from user {user_id}: {question}")

        # Calculate the number of new chat sessions
        new_session_count = 0
        if user_history:
            new_session_count = sum(
                1
                for h in user_history
                if h["type"] == "chat" and h["content"] == "New chat session"
            )
        kg_llm_retrive_path = os.path.join(
            HISTORY_DIR, user_id + "_task" + str(new_session_count) + ".csv"
        )
        init_history_file(kg_llm_retrive_path)
        # Check if this is the first chat message
        is_first_chat = False
        if not user_history:
            # If no history exists, this is the first chat
            is_first_chat = True
        else:
            # Check if this is the first chat type message
            chat_messages = [h for h in user_history if h["type"] == "chat"]
            if not chat_messages:
                is_first_chat = True
            else:
                # Check if this is the first chat after a "New chat session" message
                for i in range(len(user_history) - 1, -1, -1):
                    if (
                        user_history[i]["type"] == "chat"
                        and user_history[i]["content"] == "New chat session"
                    ):
                        is_first_chat = True
                        break
                    elif user_history[i]["type"] == "chat":
                        break
        init_history_file(kg_llm_retrive_path)
        if is_first_chat:
            # print(is_first_chat)
            kg_reulsts, final_answer = do_new_round(question, nutrition_kg)
            knowledgeGraph = (
                pandas_to_json(kg_reulsts) if not kg_reulsts.empty else None
            )
        if not is_first_chat:
            recommend_or_answer = clarify_query_intend(question)
            if recommend_or_answer:
                kg_reulsts, final_answer = do_new_round(question, nutrition_kg)
                knowledgeGraph = (
                    pandas_to_json(kg_reulsts) if not kg_reulsts.empty else None
                )
            else:
                final_answer = do_chase_question(question)
                knowledgeGraph = None
        # print(final_answer)
        if "```markdown" in final_answer:
            final_answer = re.sub(r"```markdown", "", final_answer)
            final_answer = re.sub(r"```", "", final_answer)
        return jsonify(
            {
                "finalAnswer": final_answer,
                "knowledgeGraph": knowledgeGraph,
                "isFirstChat": is_first_chat,
                "newSessionCount": new_session_count,
            }
        )

    except Exception as e:
        logger.error(f"Unexpected error in answer_question: {str(e)}")
        logger.error(traceback.format_exc())
        return jsonify({"error": f"Unexpected error: {str(e)}"}), 500


def clarify_query_intend(question):
    clarify_system_prompt = """
    You are an expert query classifier specializing in culinary intent recognition. For each input query, strictly follow these steps:

    1. Analyze the query for these recipe indicators:
    - Requests containing explicit recipe terms (e.g., "recipe", "ingredients", "step-by-step")
    - Implicit cooking verbs (e.g., "make", "prepare", "cook", "bake")
    - Measurement specifications (e.g., "cups", "tablespoons", "grams")
    - Meal component descriptors (e.g., "dinner idea", "weeknight meal")

    2. Identify answer-seeking patterns:
    - Factual food science questions (e.g., "why does...", "how does...")
    - Culinary technique explanations
    - Ingredient substitution inquiries
    - Troubleshooting cooking issues
    - Historical/nutritional food facts

    3. Classification protocol:
    - If query contains ANY recipe indicators → 'yes'
    - If recipe indicators coexist with answer elements → prioritize recipe intent → 'yes'
    - Only clear non-recipe culinary questions → 'no'

    Output Requirements:
    - Strictly lowercase 'yes'/'no' without punctuation
    - No additional explanations
    - 100% adherence to output format
    - Confidence threshold: ≥80% certainty

    """
    messages = [
        {"role": "system", "content": clarify_system_prompt},
        {"role": "system", "content": question},
    ]
    try:
        response = openai.ChatCompletion.create(
            engine=deployment, messages=messages, temperature=0.2, max_tokens=10
        )

    except Exception:
        return False
    response = response.choices[0].message.content.strip()
    if response == "yes" or response == "Yes":
        return True
    else:
        return False


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


def pandas_to_json(data_frame):
    if data_frame is None or data_frame.empty:
        return None
    try:
        # Convert DataFrame to dictionary of lists
        return {
            "subject": (list(data_frame["subject"]) if "subject" in data_frame else []),
            "relation": (
                list(data_frame["relation"]) if "relation" in data_frame else []
            ),
            "object": (list(data_frame["object"]) if "object" in data_frame else []),
            "cat": list(data_frame["cat"]) if "cat" in data_frame else [],
        }
    except Exception as e:
        logger.error(f"Error converting DataFrame to JSON: {str(e)}")
        return None


def read_chat_session_history(user_id: str) -> list:
    """
    Read the chat session history for a given user ID and return records
    where the final chat content is "New chat session".

    Args:
        user_id (str): The user ID to read history for

    Returns:
        list: A list of history records where the final chat content is "New chat session"
    """
    try:
        user_history_path = get_user_history_path(user_id)

        if not user_history_path.exists():
            logger.info(f"No history file found for user {user_id}")
            return []

        # Read all records
        with open(user_history_path, mode="r", newline="", encoding="utf-8") as file:
            reader = csv.reader(file)
            rows = list(reader)

        if not rows:
            logger.info(f"History file for user {user_id} is empty.")
            return []

        # Skip header row
        history_rows = rows[1:]

        # Process rows in reverse to find the most recent "New chat session"
        result = []
        found_new_session = False
        for row in reversed(history_rows):
            if len(row) == 3:
                type_, content, time = row
                if type_ == "chat" and content == "New chat session":
                    break
                else:
                    result.append({"type": type_, "content": content, "time": time})
                    # Stop when we find the first "New chat session" and subsequent records

        # Return in chronological order
        result_json = {}
        result_json["type"] = [r["type"] for r in reversed(result)]
        result_json["content"] = [r["content"] for r in reversed(result)]
        result_json["time"] = [r["time"] for r in reversed(result)]
        return result_json
    except Exception as e:
        logger.error(f"Error reading chat session history: {str(e)}")
        return []


def read_last_history(user_id: str) -> list:
    """
    Read the chat session history for a given user ID and return records
    where the final chat content is "New chat session".

    Args:
        user_id (str): The user ID to read history for

    Returns:
        list: A list of history records where the final chat content is "New chat session"
    """
    try:
        user_history_path = get_user_history_path(user_id)

        if not user_history_path.exists():
            logger.info(f"No history file found for user {user_id}")
            return []

        # Read all records
        with open(user_history_path, mode="r", newline="", encoding="utf-8") as file:
            reader = csv.reader(file)
            rows = list(reader)

        if not rows:
            logger.info(f"History file for user {user_id} is empty.")
            return []

        # Skip header row
        history_rows = rows[-1]
        result = {}
        result["type"] = history_rows[0]
        result["content"] = history_rows[1]
        result["time"] = history_rows[2]
        return result
    except Exception as e:
        logger.error(f"Error reading chat session history: {str(e)}")
        return []


def read_operation_history(user_id: str) -> list:
    """
    Read the chat session history for a given user ID and return records
    where the final chat content is "New chat session".

    Args:
        user_id (str): The user ID to read history for

    Returns:
        list: A list of history records where the final chat content is "New chat session"
    """
    try:
        user_history_path = get_user_history_path(user_id)

        if not user_history_path.exists():
            logger.info(f"No history file found for user {user_id}")
            return []

        # Read all records
        with open(user_history_path, mode="r", newline="", encoding="utf-8") as file:
            reader = csv.reader(file)
            rows = list(reader)

        if not rows:
            logger.info(f"History file for user {user_id} is empty.")
            return []

        # Skip header row
        history_rows = rows[1:-1]

        # Process rows in reverse to find the most recent "New chat session"
        result = []

        for row in reversed(history_rows):
            if len(row) == 3:
                type_, content, time = row
                if type_ == "apply":
                    break
                else:
                    if type_ == "include" or type_ == "exclude":
                        result.append({"type": type_, "content": content, "time": time})
                    # Stop when we find the first "New chat session" and subsequent records

        # Return in chronological order
        result_json = {}
        result_json["include"] = [
            r["content"] for r in reversed(result) if r["type"] == "include"
        ]
        result_json["exclude"] = [
            r["content"] for r in reversed(result) if r["type"] == "exclude"
        ]
        return result_json
    except Exception as e:
        logger.error(f"Error reading operation history: {str(e)}")
        return []


# Test connection when server starts
if __name__ == "__main__":
    if not test_azure_connection():
        logger.error(
            "Failed to connect to Azure OpenAI API. Server will start but API calls may fail."
        )
    app.run(host="0.0.0.0", port=5001, debug=True)

    app.run(host="0.0.0.0", port=5001, debug=True)
