const values = new Map();

const AsyncStorage = {
  getItem: jest.fn(async key => values.get(key) ?? null),
  setItem: jest.fn(async (key, value) => {
    values.set(key, value);
  }),
  removeItem: jest.fn(async key => {
    values.delete(key);
  }),
};

module.exports = {
  __esModule: true,
  default: AsyncStorage,
};
