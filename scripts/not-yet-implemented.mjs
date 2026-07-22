const [commandName = "command", milestone = "later"] = process.argv.slice(2);

console.error(`${commandName} は ${milestone} で整備する予定です。`);
process.exit(1);
