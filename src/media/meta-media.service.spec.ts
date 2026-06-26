import { MetaMediaService } from './meta-media.service';
import axios from 'axios';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('MetaMediaService', () => {
  let service: MetaMediaService;

  beforeEach(() => {
    service = new MetaMediaService();
  });

  it('should download media in two steps', async () => {
    // Step 1: Get media URL
    mockedAxios.get.mockResolvedValueOnce({
      data: {
        url: 'https://lookaside.fbsbx.com/whatsapp_business/attachments/12345',
        mime_type: 'audio/ogg',
      },
    });

    // Step 2: Download binary
    const fakeBuffer = Buffer.from('fake-audio-content');
    mockedAxios.get.mockResolvedValueOnce({
      data: fakeBuffer,
    });

    const result = await service.downloadMedia('media-id-123', 'access-token-abc');

    expect(result.mimeType).toBe('audio/ogg');
    expect(result.buffer).toBeInstanceOf(Buffer);

    // Verify Step 1 call
    expect(mockedAxios.get).toHaveBeenCalledWith(
      expect.stringContaining('media-id-123'),
      expect.objectContaining({
        headers: { Authorization: 'Bearer access-token-abc' },
      }),
    );

    // Verify Step 2 call
    expect(mockedAxios.get).toHaveBeenCalledWith(
      'https://lookaside.fbsbx.com/whatsapp_business/attachments/12345',
      expect.objectContaining({
        responseType: 'arraybuffer',
      }),
    );
  });

  it('should propagate errors from Meta API', async () => {
    mockedAxios.get.mockRejectedValueOnce(new Error('401 Unauthorized'));

    await expect(service.downloadMedia('bad-id', 'bad-token')).rejects.toThrow('401 Unauthorized');
  });
});
