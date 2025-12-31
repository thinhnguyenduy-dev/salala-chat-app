const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export async function uploadFile(file: File): Promise<string> {
  // 1. Get Signature
  const signRes = await fetch(`${API_URL}/upload/sign`);
  if (!signRes.ok) throw new Error('Failed to get upload signature');
  const { signature, timestamp, cloudName, apiKey } = await signRes.json();

  // 2. Upload to Cloudinary
  const formData = new FormData();
  formData.append('file', file);
  formData.append('signature', signature);
  formData.append('timestamp', timestamp.toString());
  formData.append('api_key', apiKey);
  formData.append('folder', 'salala_chat');

  const uploadRes = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
    method: 'POST',
    body: formData,
  });

  if (!uploadRes.ok) throw new Error('Failed to upload image');
  const data = await uploadRes.json();
  
  return data.secure_url;
}
