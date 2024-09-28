import gm from "gm";
import fs from 'fs';
import path from 'path';
import { getMetadata } from "./sharp";



const imageMagick = gm.subClass({ imageMagick: "7+" });


export interface CompressImageOptions {
  tempPath: string;
  newPath: string;
  filename: string;
  size: [number, number, "fit" | "fill"];
  crop?: [number, number, number, number] | [number, number];
}


export const compressImage = async (opts: CompressImageOptions) => {
  const oldMetadata = await getMetadata(opts.tempPath);
  if (!oldMetadata) return [null, "Could not get metadata."] as const;

  const isAnimated = !!oldMetadata.pages;

  const parsedFilename = path.parse(opts.filename);
  const newFilename = parsedFilename.name + (isAnimated ? ".gif" : ".webp");

  await fs.promises.mkdir(opts.newPath, { recursive: true });

  const newPath = path.join(opts.newPath, newFilename);

  let im = imageMagick(opts.tempPath);

  im = im.quality(90).autoOrient().coalesce();

  if (!opts.crop) {
    im = im.resize(
      opts.size[0],
      opts.size[1],
      opts.size[2] === "fit" ? ">" : "^"
    );
  }

  if (opts.crop && opts.crop?.length <= 2) {
    im = im
      .resize(opts.size[0], opts.size[1], opts.size[2] === "fit" ? ">" : "^")
      .gravity("Center")
      .crop.apply(null, opts.crop)
      .repage("+");
  }

  if (opts.crop && opts.crop?.length > 2) {
    im = im
      .crop.apply(null, opts.crop)
      .resize(opts.size[0], opts.size[1], opts.size[2] === "fit" ? ">" : "^")
      .repage("+");
  }

  return asyncWrite(im, newPath).then(async () => {
    const newMetadata = await getMetadata(newPath);
    if (!newMetadata) {
      removeFile(newPath);
      return [null, "Could not get metadata."] as const;
    }
    return [
      {
        path: newPath,
        newFilename,
        fileSize: await fs.promises.stat(newPath).then(stat => stat.size),
        dimensions: { width: newMetadata.width, height: newMetadata.height },
        gif: isAnimated,
      },
      null,
    ] as const;
  })
    .catch(err => {
      return [null, "Something went wrong while compressing image."] as const;
    })

};


async function asyncWrite(im: gm.State, filename: string) {
  return new Promise((res, rej) => {
    im.write(filename, (err) => {
      if (err) rej(err);
      else res(true);
    });
  })
}


export async function removeFile(path: string) {
  if (!path) return;
  return await fs.promises.unlink(path).catch((e) => { });
}