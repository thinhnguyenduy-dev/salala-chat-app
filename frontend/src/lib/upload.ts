const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

type ResourceType = 'image' | 'video' | 'auto';

interface UploadOptions {
  resourceType?: ResourceType;
  filename?: string;
}

export async function uploadFile(
  file: File | Blob,
  options: UploadOptions = {}
): Promise<string> {
  const { resourceType = 'auto', filename } = options;

  // 1. Get Signature
  const signRes = await fetch(`${API_URL}/upload/sign?resourceType=${resourceType}`);
  if (!signRes.ok) throw new Error('Failed to get upload signature');
  const { signature, timestamp, cloudName, apiKey } = await signRes.json();

  // 2. Upload to Cloudinary
  const formData = new FormData();

  // Handle Blob vs File (Blob needs a filename)
  if (file instanceof Blob && !(file instanceof File)) {
    const extension = file.type.split('/')[1] || 'webm';
    const defaultFilename = filename || `voice_${Date.now()}.${extension}`;
    formData.append('file', file, defaultFilename);
  } else {
    formData.append('file', file);
  }

  formData.append('signature', signature);
  formData.append('timestamp', timestamp.toString());
  formData.append('api_key', apiKey);
  formData.append('folder', 'salala_chat');

  // Use 'video' for audio files (Cloudinary treats audio as video resource type)
  const uploadType = resourceType === 'auto' ? 'auto' : resourceType;
  const uploadRes = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/${uploadType}/upload`,
    {
      method: 'POST',
      body: formData,
    }
  );

  if (!uploadRes.ok) throw new Error('Failed to upload file');
  const data = await uploadRes.json();

  return data.secure_url;
}

export async function uploadAudio(audioBlob: Blob): Promise<string> {
  return uploadFile(audioBlob, { resourceType: 'video' });
}
