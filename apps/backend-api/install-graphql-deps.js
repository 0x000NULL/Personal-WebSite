#!/usr/bin/env node

/**
 * Script to install GraphQL dependencies
 * Run with: node install-graphql-deps.js
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔧 Installing GraphQL dependencies...');

const dependencies = [
  'apollo-server-express@3.12.0',
  'graphql@16.8.1',
  'type-graphql@1.1.1',
  'graphql-subscriptions@2.0.0',
  'subscriptions-transport-ws@0.11.0',
  'graphql-depth-limit@1.1.0',
  'graphql-query-complexity@0.12.0',
  'dataloader@2.2.2',
  'reflect-metadata@0.1.13'
];

const devDependencies = [
  '@types/graphql@14.5.0'
];

try {
  // Install production dependencies
  console.log('📦 Installing production dependencies...');
  execSync(`npm install ${dependencies.join(' ')}`, { stdio: 'inherit' });

  // Install dev dependencies
  console.log('📦 Installing dev dependencies...');
  execSync(`npm install --save-dev ${devDependencies.join(' ')}`, { stdio: 'inherit' });

  console.log('✅ GraphQL dependencies installed successfully!');
  
  // Update package.json scripts
  const packageJsonPath = path.join(__dirname, 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  
  // Add GraphQL-related scripts
  packageJson.scripts = {
    ...packageJson.scripts,
    'graphql:schema': 'tsx src/graphql/schema.ts',
    'graphql:introspect': 'graphql-inspector introspect schema.gql',
    'graphql:validate': 'graphql-inspector validate "src/**/*.ts" schema.gql'
  };

  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
  console.log('📝 Updated package.json scripts');

  console.log('\n🎉 GraphQL setup complete!');
  console.log('\nNext steps:');
  console.log('1. Start the server: npm run dev');
  console.log('2. Visit GraphQL Playground: http://localhost:3001/graphql');
  console.log('3. Test subscriptions: ws://localhost:3001/graphql-subscriptions');

} catch (error) {
  console.error('❌ Failed to install dependencies:', error.message);
  process.exit(1);
}