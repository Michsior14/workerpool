// source of inspiration: https://github.com/sindresorhus/require-fool-webpack

// eslint-disable-next-line no-eval
export const requireFoolWebpack: typeof require = eval(
  "typeof require !== 'undefined' " +
    '? require ' +
    ': function (module) { throw new Error(\'Module " + module + " not found.\') }'
);
