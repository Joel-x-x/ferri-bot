import { SttService } from './stt.service';

const mockCreate = jest.fn();
const mockToFile = jest.fn();

jest.mock('openai', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    audio: { transcriptions: { create: (...args: any[]) => mockCreate(...args) } },
  })),
  toFile: (...args: any[]) => mockToFile(...args),
}));

describe('SttService', () => {
  let service: SttService;

  beforeEach(() => {
    process.env.GROQ_API_KEY = 'test-groq-key';
    process.env.OPENAI_API_KEY = 'test-openai-key';
    service = new SttService();
    mockCreate.mockReset();
    mockCreate.mockResolvedValue({ text: 'Hola necesito tornillos' });
    mockToFile.mockReset();
    mockToFile.mockResolvedValue({ name: 'audio.ogg' });
  });

  afterEach(() => {
    delete process.env.GROQ_API_KEY;
    delete process.env.OPENAI_API_KEY;
  });

  it('should transcribe audio with primary provider', async () => {
    const buffer = Buffer.from('fake-audio-data');
    const result = await service.transcribe(buffer, 'audio/ogg', 'groq', 'openai');

    expect(result).toBe('Hola necesito tornillos');
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'whisper-large-v3',
        language: 'es',
      }),
    );
  });

  it('should return null for oversized audio', async () => {
    const buffer = Buffer.alloc(26 * 1024 * 1024); // 26MB > 25MB limit
    const result = await service.transcribe(buffer, 'audio/ogg');

    expect(result).toBeNull();
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('should fall back to secondary provider on failure', async () => {
    mockCreate
      .mockRejectedValueOnce(new Error('Groq down'))
      .mockResolvedValueOnce({ text: 'fallback transcription' });

    const buffer = Buffer.from('fake-audio');
    const result = await service.transcribe(buffer, 'audio/ogg', 'groq', 'openai');

    expect(result).toBe('fallback transcription');
    expect(mockCreate).toHaveBeenCalledTimes(2);
  });

  it('should return null when both providers fail', async () => {
    mockCreate.mockRejectedValue(new Error('All down'));

    const buffer = Buffer.from('fake-audio');
    const result = await service.transcribe(buffer, 'audio/ogg', 'groq', 'openai');

    expect(result).toBeNull();
  });

  it('should return null when no API key configured', async () => {
    delete process.env.GROQ_API_KEY;
    delete process.env.OPENAI_API_KEY;

    const buffer = Buffer.from('fake-audio');
    const result = await service.transcribe(buffer, 'audio/ogg', 'groq', 'openai');

    expect(result).toBeNull();
  });
});
