import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';

export type UploadFile = {
  uri: string;
  name: string;
  type: string;
};

export function getAssetName(asset: any, fallback = 'file') {
  const name = asset?.name || asset?.fileName || asset?.uri?.split('/').pop();
  return String(name || fallback);
}

export function getAssetMime(asset: any, fallback = 'application/octet-stream') {
  if (asset?.mimeType) return String(asset.mimeType);

  const name = String(asset?.name || asset?.fileName || asset?.uri || '').toLowerCase();

  if (name.endsWith('.jpg') || name.endsWith('.jpeg')) return 'image/jpeg';
  if (name.endsWith('.png')) return 'image/png';
  if (name.endsWith('.webp')) return 'image/webp';
  if (name.endsWith('.heic')) return 'image/heic';
  if (name.endsWith('.pdf')) return 'application/pdf';
  if (name.endsWith('.doc')) return 'application/msword';
  if (name.endsWith('.docx')) return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  if (name.endsWith('.xls')) return 'application/vnd.ms-excel';
  if (name.endsWith('.xlsx')) return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

  return fallback;
}

export function imageAssetToUploadFile(asset: ImagePicker.ImagePickerAsset, fallbackName = 'image.jpg'): UploadFile {
  return {
    uri: asset.uri,
    name: getAssetName(asset, fallbackName),
    type: getAssetMime(asset, 'image/jpeg'),
  };
}

export function documentAssetToUploadFile(asset: DocumentPicker.DocumentPickerAsset, fallbackName = 'file'): UploadFile {
  return {
    uri: asset.uri,
    name: getAssetName(asset, fallbackName),
    type: getAssetMime(asset),
  };
}

export function appendFile(fd: FormData, fieldName: string, file: UploadFile) {
  fd.append(fieldName, file as any);
}