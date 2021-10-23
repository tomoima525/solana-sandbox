export class FreezeAccountArgs {
  instruction = 0;
}

export const FREEZE_ACCOUNT_SCHEMA = new Map<any, any>([
  [
    FreezeAccountArgs,
    {
      kind: 'struct',
      fields: [['instruction', 'u8']],
    },
  ],
]);
