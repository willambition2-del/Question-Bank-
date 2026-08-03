import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Global mocks
global.fetch = vi.fn();
