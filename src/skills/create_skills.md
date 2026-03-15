# How to Create Skills

This skill describes how to document and implement new Standard Operating Procedures (SOPs) as Skills.

## Objective
To capture complex, multi-step expertise in a format the agent can reference and follow.

## Structure
Skills MUST be written in Markdown (\`.md\`) and follow this structure:
1. **Title**: A clear H1 header.
2. **Description**: A brief summary of the skill's purpose.
3. **Objective**: What the skill aims to achieve.
4. **Steps**: A numbered list of executable actions, referencing specific Tools where applicable.

## Implementation
1. Create a new \`.md\` file in \`src/skills/\`.
2. Ensure the filename is descriptive and uses underscores (e.g., \`market_analysis.md\`).
3. Deploy the file to the environment where Nujin is running.
