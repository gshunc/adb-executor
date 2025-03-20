import pandas as pd
import matplotlib.pyplot as plt
import numpy as np
import os

# Read the CSV file
data_path = os.path.join('server', 'logs', 'data.csv')
df = pd.read_csv(data_path, sep=',\s*', engine='python')

# Clean up the data (remove any whitespace in column names)
df.columns = df.columns.str.strip()

# Set up the figure size
plt.figure(figsize=(15, 20))

# Define strategies to compare with dry run
strategies = ['topLeft', 'topRight', 'bottomLeft', 'bottomRight']

# Create a directory for saving the graphs if it doesn't exist
output_dir = os.path.join('server', 'logs', 'graphs')
os.makedirs(output_dir, exist_ok=True)

# Part 1: Compare similarity scores
plt.subplot(2, 1, 1)
dry_row = df[df['type'] == 'dry'].iloc[0]

# Create x-axis labels for the similarity scores
similarity_cols = ['similarity_overall', 'left', 'right', 'up', 'down']
x = np.arange(len(similarity_cols))
width = 0.15  # Width of the bars

# Plot dry run as a reference
plt.bar(x, dry_row[similarity_cols], width, label='dry')

# Plot each strategy
for i, strategy in enumerate(strategies, 1):
    strategy_row = df[df['type'] == strategy].iloc[0]
    plt.bar(x + width * i, strategy_row[similarity_cols], width, label=strategy)

plt.xlabel('Metrics')
plt.ylabel('Similarity Score')
plt.title('Comparison of Similarity Scores: Each Strategy vs Dry Run')
plt.xticks(x + width * 2, similarity_cols)
plt.legend()
plt.grid(axis='y', linestyle='--', alpha=0.7)

# Part a + b: Save individual plots for each strategy compared to dry run
for strategy in strategies:
    strategy_row = df[df['type'] == strategy].iloc[0]
    
    # a) Similarity scores comparison
    plt.figure(figsize=(12, 10))
    plt.subplot(2, 1, 1)
    
    # Prepare data for plotting
    metrics = ['similarity_overall', 'left', 'right', 'up', 'down']
    dry_scores = dry_row[metrics].values
    strategy_scores = strategy_row[metrics].values
    
    # Create side-by-side bars
    x = np.arange(len(metrics))
    width = 0.35
    
    plt.bar(x - width/2, dry_scores, width, label='dry')
    plt.bar(x + width/2, strategy_scores, width, label=strategy)
    
    plt.xlabel('Metrics')
    plt.ylabel('Similarity Score')
    plt.title(f'Similarity Scores Comparison: {strategy} vs Dry Run')
    plt.xticks(x, metrics)
    plt.legend()
    plt.grid(axis='y', linestyle='--', alpha=0.7)
    
    # b) Direction percentages comparison
    plt.subplot(2, 1, 2)
    
    # Prepare data for plotting
    direction_cols = ['right_percentage', 'left_percentage', 'up_percentage', 'down_percentage']
    dry_percentages = dry_row[direction_cols].values
    strategy_percentages = strategy_row[direction_cols].values
    
    # Create side-by-side bars
    x = np.arange(len(direction_cols))
    
    plt.bar(x - width/2, dry_percentages, width, label='dry')
    plt.bar(x + width/2, strategy_percentages, width, label=strategy)
    
    plt.xlabel('Directions')
    plt.ylabel('Percentage')
    plt.title(f'Direction Percentages Comparison: {strategy} vs Dry Run')
    plt.xticks(x, [col.split('_')[0].upper() for col in direction_cols])
    plt.legend()
    plt.grid(axis='y', linestyle='--', alpha=0.7)
    
    plt.tight_layout()
    plt.savefig(os.path.join(output_dir, f'{strategy}_vs_dry.png'))
    plt.close()

# Create a radar chart for each strategy vs dry run
plt.figure(figsize=(20, 15))

for i, strategy in enumerate(strategies, 1):
    plt.subplot(2, 2, i)
    strategy_row = df[df['type'] == strategy].iloc[0]
    
    # Prepare data for the radar chart
    categories = ['Left', 'Right', 'Up', 'Down']
    dry_values = [dry_row['left'], dry_row['right'], dry_row['up'], dry_row['down']]
    strategy_values = [strategy_row['left'], strategy_row['right'], strategy_row['up'], strategy_row['down']]
    
    # Calculate angles for the radar chart
    N = len(categories)
    angles = [n / float(N) * 2 * np.pi for n in range(N)]
    angles += angles[:1]  # Close the loop
    
    # Add the values for the radar chart, and close the loop
    dry_values += dry_values[:1]
    strategy_values += strategy_values[:1]
    
    # Set up the radar chart
    ax = plt.subplot(2, 2, i, polar=True)
    
    # Plot dry run
    ax.plot(angles, dry_values, 'o-', linewidth=2, label='dry')
    ax.fill(angles, dry_values, alpha=0.25)
    
    # Plot strategy
    ax.plot(angles, strategy_values, 'o-', linewidth=2, label=strategy)
    ax.fill(angles, strategy_values, alpha=0.25)
    
    # Set the labels and ticks
    ax.set_thetagrids(np.degrees(angles[:-1]), categories)
    ax.set_title(f'Similarity Comparison: {strategy} vs Dry Run')
    ax.grid(True)
    plt.legend(loc='upper right')

plt.tight_layout()
plt.savefig(os.path.join(output_dir, 'radar_charts.png'))

# Create a comprehensive bar chart showing percentage differences
plt.figure(figsize=(15, 10))

# Define directions
directions = ['RIGHT', 'LEFT', 'UP', 'DOWN']

# Define colors for each direction
colors = {'RIGHT': 'red', 'LEFT': 'blue', 'UP': 'green', 'DOWN': 'purple'}

# Create a grouped bar chart
bar_width = 0.15
index = np.arange(len(strategies) + 1)  # +1 for dry run

# Plot each direction as a group
for i, direction in enumerate(directions):
    col = direction.lower() + '_percentage'
    values = [df[df['type'] == 'dry'][col].values[0]] + [df[df['type'] == strategy][col].values[0] for strategy in strategies]
    plt.bar(index + i * bar_width, values, bar_width, label=direction, color=colors[direction])

plt.xlabel('Strategy')
plt.ylabel('Percentage')
plt.title('Direction Percentages Across All Strategies')
plt.xticks(index + bar_width * 1.5, ['dry'] + strategies)
plt.legend()
plt.grid(axis='y', linestyle='--', alpha=0.7)

plt.tight_layout()
plt.savefig(os.path.join(output_dir, 'direction_percentages_by_strategy.png'))

print(f"Graphs have been generated and saved to {output_dir}")
