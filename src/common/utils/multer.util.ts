import { BadRequestException } from "@nestjs/common";
import { memoryStorage } from "multer";

export const avatarMulterConfig = {
    storage: memoryStorage(),
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB
    },
    fileFilter: (req: any, file: Express.Multer.File, cb: any) => {
        const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/avif', 'image/jpg'];
        if(!allowedTypes.includes(file.mimetype)) {
            return cb(
                new BadRequestException('Only image files are allowed (jpg, jpeg, png, gif, webp, avif)'),
                false
            );
        }
        cb(null, true);
    }
}