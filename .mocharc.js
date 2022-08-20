'use strict'

module.exports = {  
  exit: true,
  bail: false,
  slow: 1000,
  recursive: true,
  extension: [
    'ts'
  ],
  spec: [
    'src/**/*.spec.ts'
  ],
  require: [
    'ts-node/register/transpile-only',
    'source-map-support/register'
  ]
}