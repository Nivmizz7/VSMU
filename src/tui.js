const readline = require("readline");

function clearScreen() {
  process.stdout.write("\x1b[2J\x1b[0f");
}

function divider(width) {
  return "-".repeat(width);
}

function formatRow(columns, widths) {
  return columns
    .map((col, i) => {
      const text = String(col);
      const width = widths[i];
      if (text.length > width) {
        return text.slice(0, width - 3) + "...";
      }
      return text.padEnd(width, " ");
    })
    .join(" | ");
}

function printTable(title, headers, rows) {
  const widths = headers.map((h, i) => {
    const maxRow = rows.reduce((max, row) => Math.max(max, String(row[i]).length), 0);
    return Math.max(String(h).length, maxRow, 8);
  });
  const totalWidth = widths.reduce((sum, w) => sum + w, 0) + (headers.length - 1) * 3;
  if (title) {
    console.log(title);
    console.log(divider(totalWidth));
  }
  console.log(formatRow(headers, widths));
  console.log(divider(totalWidth));
  rows.forEach((row) => console.log(formatRow(row, widths)));
  console.log(divider(totalWidth));
}

function progressBar(label, current, total, width) {
  const barWidth = Math.max(10, Math.min(width || 40, 60));
  const ratio = total > 0 ? current / total : 0;
  const filled = Math.round(ratio * barWidth);
  const bar = "#".repeat(filled) + "-".repeat(barWidth - filled);
  const percent = (ratio * 100).toFixed(0).padStart(3, " ");
  const line = `${label} [${bar}] ${percent}%`;
  process.stdout.write(`\r${line}`);
}

function promptInput(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

async function menu(title, options) {
  console.log(title);
  options.forEach((opt, idx) => {
    console.log(`  ${idx + 1}) ${opt}`);
  });
  const answer = await promptInput("Select option: ");
  const choice = Number.parseInt(answer, 10);
  if (Number.isNaN(choice) || choice < 1 || choice > options.length) {
    return -1;
  }
  return choice - 1;
}

module.exports = {
  clearScreen,
  printTable,
  progressBar,
  promptInput,
  menu
};
