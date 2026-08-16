export interface AssistantSourceReference {
  documentId: string;
  pageNumber: number | null;
  title: string;
}

export interface AssistantResponse {
  requestId: string;
  status: 'COMPLETED' | 'INSUFFICIENT_CONTEXT';
  summary: string;
  steps: string[];
  keyConcept: string | null;
  commonMistake: string | null;
  sourceReferences: AssistantSourceReference[];
  usage: {
    remainingToday: number | null;
    remaining?: number | null;
    used?: number;
    limit?: number;
    resetPeriod?: string;
    resetAt?: string | null;
  };
}

export function assertPublicResponsePrivacy(value: unknown): void {
  const serialized = JSON.stringify(value).toLowerCase();
  const forbidden = [
    'providerid',
    'modelid',
    'remotemodelid',
    'routingpolicy',
    'apikey',
    'estimatedcost',
    'internalname',
  ];
  if (forbidden.some((field) => serialized.includes(`"${field}"`))) {
    throw new Error('Public assistant response contains internal metadata');
  }
}
