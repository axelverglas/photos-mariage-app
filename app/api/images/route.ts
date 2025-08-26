import { v2 as cloudinary } from "cloudinary";

if (!process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
  throw new Error("Cloudinary credentials are missing");
}

cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const cursor = searchParams.get("cursor");
    const limit = 12;

    const result = await cloudinary.search
      .expression("resource_type:image AND tags:mariage")
      .sort_by("created_at", "desc")
      .max_results(limit)
      .next_cursor(cursor || undefined)
      .execute();

    // Récupérer le nombre total d'images dans une requête séparée
    const totalResult = await cloudinary.search
      .expression("resource_type:image")
      .max_results(0)
      .execute();

    return Response.json({
      images: result.resources,
      totalPages: Math.ceil(totalResult.total_count / limit),
      currentPage: cursor ? Math.ceil(result.resources.length / limit) : 1,
      total: totalResult.total_count,
      nextCursor: result.next_cursor,
    });
  } catch (error) {
    console.error("Erreur lors de la récupération des images:", error);
    return Response.json(
      { error: "Erreur lors de la récupération des images" },
      { status: 500 }
    );
  }
}
