export interface ComponentType<T> {
  readonly key: symbol;
  readonly name: string;
}

export function createComponentType<T>(name: string): ComponentType<T> {
  return {
    key: Symbol(name),
    name,
  };
}
