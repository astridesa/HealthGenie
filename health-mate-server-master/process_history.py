import pandas as pd
import os

# Read the history.csv file
df = pd.read_csv("history.csv")

# Create history directory if it doesn't exist
os.makedirs("history", exist_ok=True)

# Group by ID and create separate files for each user
for user_id, group in df.groupby("id"):
    if pd.isna(user_id) or user_id == "":
        continue

    # Select only type, content, and time columns
    user_history = group[["type", "content", "time"]]

    # Create filename with user ID
    filename = f"history/{user_id}.csv"

    # Save to CSV
    user_history.to_csv(filename, index=False)

print("History files have been created successfully!")
