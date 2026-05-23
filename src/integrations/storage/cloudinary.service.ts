import { Injectable, Logger } from '@nestjs/common';
import { v2 as cloudinary } from 'cloudinary';
import { Readable } from 'stream';

@Injectable()
export class CloudinaryService {
  private readonly logger = new Logger(CloudinaryService.name);

  // ─── Upload Image (Avatars / Profile Pictures) ──────────────────────────────
  async uploadImage(
    file: Express.Multer.File,
    folder = 'ai-chat/avatars',
  ): Promise<{ url: string; publicId: string }> {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder,
          transformation: [
            { width: 400, height: 400, crop: 'fill', gravity: 'face' },
            { quality: 'auto', fetch_format: 'auto' },
          ],
        },
        (error, result) => {
          if (error) {
            this.logger.error('Cloudinary upload failed', error);
            return reject(error);
          }
          resolve({
            url: result.secure_url,
            publicId: result.public_id,
          });
        },
      );

      // Convert Buffer to Readable Stream
      const stream = Readable.from(file.buffer);
      stream.pipe(uploadStream);
    });
  }

  // ─── Delete Image ───────────────────────────────────────────────────────────
  async deleteImage(publicId: string): Promise<void> {
    try {
      await cloudinary.uploader.destroy(publicId);
      this.logger.log(`🗑️ Deleted image: ${publicId}`);
    } catch (err) {
      this.logger.error('Cloudinary delete failed', err);
    }
  }

  // ─── Upload Chat Media (Images, Videos, Audio, Files) ──────────────────────
  async uploadChatMedia(
    file: Express.Multer.File,
    folder = 'ai-chat/media',
  ): Promise<{ url: string; publicId: string; resourceType: string }> {
    return new Promise((resolve, reject) => {
      
      // Determine Cloudinary resource_type based on file mimetype
      let resourceType: 'image' | 'video' | 'raw' = 'raw';
      if (file.mimetype.startsWith('image/')) resourceType = 'image';
      
      // Cloudinary treats audio files under the 'video' resource type category
      if (file.mimetype.startsWith('video/') || file.mimetype.startsWith('audio/')) {
        resourceType = 'video'; 
      }

      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder,
          resource_type: resourceType, // Automatic detection (image, video, raw file)
          quality: 'auto', // File size optimization
        },
        (error, result) => {
          if (error) {
            this.logger.error('Cloudinary chat media upload failed', error);
            return reject(error);
          }
          resolve({
            url: result.secure_url,
            publicId: result.public_id,
            resourceType: result.resource_type,
          });
        },
      );

      // Convert Buffer to Readable Stream
      const stream = Readable.from(file.buffer);
      stream.pipe(uploadStream);
    });
  }

  // ─── Extract PublicId from URL ──────────────────────────────────────────────
  extractPublicId(url: string): string | null {
    try {
      const parts = url.split('/');
      const uploadIndex = parts.indexOf('upload');
      if (uploadIndex === -1) return null;

      // Skip the version tag (e.g., v123) and gather the path segments
      const pathParts = parts.slice(uploadIndex + 2);
      const filename = pathParts.join('/');
      
      return filename.replace(/\.[^/.]+$/, ''); // Remove the file extension
    } catch {
      return null;
    }
  }
}