module.exports = {
  env: {
    node: true,
    jest: true,
  },
  parserOptions: {
    project: 'tsconfig.json',
    sourceType: 'module',
  },
  extends: [
    'airbnb-base',
  ],
  parser: '@typescript-eslint/parser',
  plugins: [
    '@typescript-eslint',
  ],
  root: true,
  ignorePatterns: ['.eslintrc.js'],
  rules: {
    'indent': ['error', 4],
    '@typescript-eslint/interface-name-prefix': 'off',
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/no-explicit-any': 'off',
    'import/no-unresolved': 'off',
    'no-useless-constructor': 'off',
    'import/prefer-default-export': 'off',
    'no-await-in-loop': 'off',
    'no-unused-vars': 'off',
    'no-empty-function': 'off',
    'class-methods-use-this': 'off',
    'no-underscore-dangle': 'off',
    '@typescript-eslint/no-unused-vars': [
      'error'
    ],
    'import/extensions': 'off',
    'import/no-extraneous-dependencies': 'off'
  },
  globals: {
    document: true,
    window: true,
    fetch: true,
    socket: true,
    mediasoupClient: true,
    io: true,
  }
};
