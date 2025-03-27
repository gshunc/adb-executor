import pandas as pd
import matplotlib.pyplot as plt
import numpy as np
import os

# Read the CSV file
data_path = os.path.join('server', 'logs', 'data.csv')
df = pd.read_csv(data_path, sep=',\s*', engine='python')

# Clean up the data (remove any whitespace in column names)
df.columns = df.columns.str.strip()

# Create a directory for saving the graphs if it doesn't exist
output_dir = os.path.join('server', 'logs', 'graphs')
os.makedirs(output_dir, exist_ok=True)

# Filter the data for the topLeft and topLeft4o entries
topleft_row = df[df['type'] == 'topLeft'].iloc[0]
topleft4o_row = df[df['type'] == 'topLeft4o'].iloc[0]

# 1. Create side-by-side comparison for similarity scores
plt.figure(figsize=(12, 8))
plt.subplot(2, 1, 1)

# Prepare data for similarity score comparison
directions = ['left', 'right', 'up', 'down']
topleft_scores = [topleft_row[direction] for direction in directions]
topleft4o_scores = [topleft4o_row[direction] for direction in directions]

# Set positions for bars
x = np.arange(len(directions))
width = 0.35

# Create the bars
plt.bar(x - width/2, topleft_scores, width, label='GPT-4o-mini', color='skyblue')
plt.bar(x + width/2, topleft4o_scores, width, label='GPT-4o', color='orangered')

# Add labels and title
plt.ylabel('Similarity Score')
plt.title('Direction Similarity Scores: topLeft vs topLeft4o')
plt.xticks(x, [d.upper() for d in directions])
plt.legend()
plt.grid(axis='y', linestyle='--', alpha=0.7)

# 2. Create side-by-side comparison for percentages
plt.subplot(2, 1, 2)

# Prepare data for percentage comparison
percentage_cols = ['left_percentage', 'right_percentage', 'up_percentage', 'down_percentage']
topleft_percentages = [topleft_row[col] for col in percentage_cols]
topleft4o_percentages = [topleft4o_row[col] for col in percentage_cols]

# Create the bars
plt.bar(x - width/2, topleft_percentages, width, label='GPT-4o-mini', color='skyblue')
plt.bar(x + width/2, topleft4o_percentages, width, label='GPT-4o', color='orangered')

# Add labels and title
plt.xlabel('Direction')
plt.ylabel('Percentage (%)')
plt.title('Direction Percentages: topLeft vs topLeft4o')
plt.xticks(x, [col.split('_')[0].upper() for col in percentage_cols])
plt.legend()
plt.grid(axis='y', linestyle='--', alpha=0.7)

plt.tight_layout()
plt.savefig(os.path.join(output_dir, 'topleft_vs_topleft4o.png'))

# 3. Create a more detailed visualization with overall similarity included
plt.figure(figsize=(14, 10))

# Include overall similarity in the metrics
all_metrics = ['similarity_overall'] + directions
x_all = np.arange(len(all_metrics))

# Get all similarity scores
topleft_all_scores = [topleft_row[metric] for metric in all_metrics]
topleft4o_all_scores = [topleft4o_row[metric] for metric in all_metrics]

# Create the bars
plt.bar(x_all - width/2, topleft_all_scores, width, label='GPT-4o-mini', color='skyblue')
plt.bar(x_all + width/2, topleft4o_all_scores, width, label='GPT-4o', color='orangered')

# Add labels and a more detailed title
plt.xlabel('Metric')
plt.ylabel('Similarity Score')
plt.title('Comprehensive Comparison: topLeft vs topLeft4o Similarity Scores')
plt.xticks(x_all, ['OVERALL'] + [d.upper() for d in directions])
plt.legend()
plt.grid(axis='y', linestyle='--', alpha=0.7)

# Add value labels on top of each bar
for i, v in enumerate(topleft_all_scores):
    plt.text(i - width/2, v + 0.01, f'{v:.4f}', ha='center', va='bottom', fontsize=9, rotation=45)
for i, v in enumerate(topleft4o_all_scores):
    plt.text(i + width/2, v + 0.01, f'{v:.4f}', ha='center', va='bottom', fontsize=9, rotation=45)

plt.tight_layout()
plt.savefig(os.path.join(output_dir, 'topleft_vs_topleft4o_comprehensive.png'))

# 4. Create a combined view showing percentage differences
plt.figure(figsize=(10, 8))

# Prepare the percentage data
x_perc = np.arange(len(percentage_cols))
bar_width = 0.35

# Create the bars
plt.bar(x_perc - bar_width/2, topleft_percentages, bar_width, label='GPT-4o-mini', color='skyblue')
plt.bar(x_perc + bar_width/2, topleft4o_percentages, bar_width, label='GPT-4o', color='orangered')

# Add labels and title
plt.xlabel('Direction')
plt.ylabel('Percentage (%)')
plt.title('Direction Distribution Comparison: topLeft vs topLeft4o')
plt.xticks(x_perc, [col.split('_')[0].upper() for col in percentage_cols])
plt.legend()
plt.grid(axis='y', linestyle='--', alpha=0.7)

# Add value labels on top of each bar
for i, v in enumerate(topleft_percentages):
    plt.text(i - bar_width/2, v + 1, f'{v:.2f}%', ha='center', va='bottom')
for i, v in enumerate(topleft4o_percentages):
    plt.text(i + bar_width/2, v + 1, f'{v:.2f}%', ha='center', va='bottom')

# Add a subtitle explaining the difference
plt.figtext(0.5, 0.01, 
            f"Overall Similarity: topLeft = {topleft_row['similarity_overall']:.4f}, topLeft4o = {topleft4o_row['similarity_overall']:.4f}", 
            ha="center", fontsize=10, bbox={"facecolor":"lightgray", "alpha":0.5, "pad":5})

plt.tight_layout(rect=[0, 0.05, 1, 0.95])
plt.savefig(os.path.join(output_dir, 'topleft_vs_topleft4o_percentages.png'))

print(f"Comparison graphs between topLeft and topLeft4o have been saved to {output_dir}")
