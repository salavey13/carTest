#!/usr/bin/env node

/**
 * Hello World Skill
 * A simple demonstration skill
 */

function hello(name = 'World') {
  console.log(`Hello, ${name}!`);
}

function main() {
  const args = process.argv.slice(2);
  const name = args[0] || 'World';
  hello(name);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { hello };
