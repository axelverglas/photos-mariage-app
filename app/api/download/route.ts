import { v2 as cloudinary } from "cloudinary";
import JSZip from "jszip";

type CloudinaryImage = {
  public_id: string;
  secure_url: string;
  created_at: string;
};

if (!process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
  throw new Error("Cloudinary credentials are missing");
}

cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export async function POST(request: Request) {
  try {
    const { images } = await request.json();
    const zip = new JSZip();

    // Récupérer les détails des images depuis Cloudinary
    const result = await cloudinary.search
      .expression(`public_id:${images.join(" OR public_id:")}`)
      .execute();

    // Télécharger toutes les images et les ajouter au ZIP
    await Promise.all(
      result.resources.map(async (image: CloudinaryImage) => {
        // Ajouter l'extension .jpg au nom du fichier
        const baseName = image.public_id.split("/").pop() || "photo";
        const fileName = `${baseName}.jpg`;

        const response = await fetch(image.secure_url);
        const buffer = await response.arrayBuffer();
        zip.file(fileName, buffer);
      })
    );

    // Générer le fichier ZIP
    const zipContent = await zip.generateAsync({ type: "arraybuffer" });

    return new Response(zipContent, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": "attachment; filename=photos.zip",
      },
    });
  } catch (error) {
    console.error("Erreur lors de la création du ZIP:", error);
    return Response.json(
      { error: "Erreur lors de la création du ZIP" },
      { status: 500 }
    );
  }
}
