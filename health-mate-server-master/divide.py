import pandas as pd
import re

class MyObject:
    def __init__(self, chinese, name, category):
        # 使用关键字参数来初始化对象的属性
        self.chinese = chinese
        self.name = name
        self.category = category

    def __hash__(self):
        # 使用对象的所有 key 和 value 组成一个元组，并计算哈希值
        return hash((self.chinese, self.name, self.category))

    def __eq__(self, other):
        # 比较两个对象的 chinese 和 english 是否相等
        return (self.chinese, self.name, self.category) == (other.chinese, other.name, other.category)

# 读取 CSV 文件
df = pd.read_csv('./Demo_recipe_cleaned.csv', encoding='utf-8')

df = df[df['relation'] == '食材构成']

subjects = df['subject']

objects = df['object']



# combined = pd.concat([subjects, objects], ignore_index=True, axis=0)

node_set = set()

rows = df.shape[0]


for i in range(rows):
    menu = df.iloc[i, 0]
    node_set.add(MyObject(menu, menu, 'menu'))

for i in range(rows):
    food = df.iloc[i, 2]
    category = df.iloc[i, 3]
    node_set.add(MyObject(food, food, category))

#
# 为每个节点分配一个 id
ts_data = [
    {"id": idx + 1, "chinese": obj.chinese, "name": obj.name, 'category': obj.category}
    for idx, obj in enumerate(list(node_set))
]

# 创建一个字典，快速查找节点名称对应的 id
name_to_id = {node['chinese']: node['id'] for node in ts_data}

# 生成新的数据，包含 source, target 和 relation
rows = df.shape[0]
relations_data = []

for i in range(rows):
    relations_data.append({
        "source": name_to_id[df.iloc[i, 0]],
        "target": name_to_id[df.iloc[i, 2]],
        "relation": df.iloc[i, 1]
    })

# 创建 TypeScript 内容
ts_content = f"""
export const nodes = {str(ts_data).replace("'", '"')};
export const links = {str(relations_data).replace("'", '"')};
"""

# 写入 ts 文件
ts_file_path = './data.ts'

with open(ts_file_path, 'w', encoding='utf-8') as f:
    f.write(ts_content)
