# How to Create Tools

This skill describes the process for creating new executable Javascript tools for the Nujin agent.

## Objective
To extend the agent's functional capabilities with atomic, reusable code snippets.

## Steps
1. **Identify Need**: Determine the specific external interaction required (e.g., a specific API call).
2. **Draft Code**: Write a compact Javascript snippet.
   - Use \`fetch\` for HTTP requests.
   - Always assign the final result to the global \`result\` variable.
3. **Persist**: Use the \`create_tool\` function to save the code to the database.
4. **Test**: Execute the newly created tool to verify the output.

## Code Example
\`\`\`javascript
result = await fetch('https://api.example.com/data').then(r => r.json());
\`\`\`
