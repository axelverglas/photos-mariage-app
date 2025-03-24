"use client";
import { Suspense } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { signIn, useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { CldUploadButton, CldImage } from "next-cloudinary";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { Download } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";

type CloudinaryImage = {
  public_id: string;
  secure_url: string;
  created_at: string;
};

type ImagesResponse = {
  images: CloudinaryImage[];
  totalPages: number;
  currentPage: number;
  total: number;
  nextCursor: string | null;
};

const formSchema = z.object({
  code: z.string().min(1, "Le code d'accès est requis"),
});

function PhotoGallery() {
  const { data: session, status } = useSession();
  const searchParams = useSearchParams();
  const code = searchParams.get("code");
  const [cursor, setCursor] = useState<string | null>(null);
  const [selectedImages, setSelectedImages] = useState<Set<string>>(new Set());
  const [selectAll, setSelectAll] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["images", cursor],
    queryFn: async () => {
      const url = new URL("/api/images", window.location.origin);
      if (cursor) {
        url.searchParams.set("cursor", cursor);
      }
      const response = await fetch(url);
      if (!response.ok) throw new Error("Erreur réseau");
      return response.json() as Promise<ImagesResponse>;
    },
    enabled: !!session,
  });

  useEffect(() => {
    if (code) {
      signIn("credentials", {
        code: code,
        redirect: false,
      });
    }
  }, [code]);

  const toggleImageSelection = (publicId: string) => {
    const newSelection = new Set(selectedImages);
    if (newSelection.has(publicId)) {
      newSelection.delete(publicId);
    } else {
      newSelection.add(publicId);
    }
    setSelectedImages(newSelection);
  };

  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedImages(new Set());
    } else {
      setSelectedImages(
        new Set(data?.images.map((img) => img.public_id) || [])
      );
    }
    setSelectAll(!selectAll);
  };

  const downloadSelectedImages = async () => {
    try {
      const selectedImagesArray = Array.from(selectedImages);

      if (selectedImagesArray.length === 1) {
        const image = data?.images.find(
          (img) => img.public_id === selectedImagesArray[0]
        );
        if (image) {
          const link = document.createElement("a");
          link.href = image.secure_url.replace(
            "/upload/",
            "/upload/fl_attachment/"
          );
          const fileName = image.public_id.split("/").pop() || "photo.jpg";
          link.setAttribute("download", fileName);
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        }
        return;
      }

      const response = await fetch("/api/download", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          images: selectedImagesArray,
        }),
      });

      if (!response.ok) throw new Error("Erreur lors du téléchargement");

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", "photos.zip");
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Erreur lors du téléchargement:", error);
    }
  };

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Chargement...</p>
      </div>
    );
  }

  return (
    <>
      <div className="flex justify-between items-center mb-8">
        <CldUploadButton
          onUpload={() => refetch()}
          uploadPreset="qzsedazf"
          options={{
            tags: ["mariage"],
          }}
          className="bg-primary text-white px-4 py-2 rounded-md hover:bg-primary/90"
        >
          Ajouter des photos
        </CldUploadButton>

        <div className="flex gap-4">
          <Button variant="outline" onClick={handleSelectAll}>
            {selectAll ? "Désélectionner tout" : "Sélectionner tout"}
          </Button>
          {selectedImages.size > 0 && (
            <Button
              onClick={downloadSelectedImages}
              className="flex items-center gap-2"
              variant="default"
            >
              <Download className="w-4 h-4" />
              Télécharger{" "}
              {selectedImages.size > 1 ? `(${selectedImages.size})` : ""}
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-8">
        {isLoading
          ? Array.from({ length: 4 }).map((_, index) => (
              <div
                key={index}
                className="aspect-square relative overflow-hidden rounded-lg"
              >
                <Skeleton className="w-full h-full" />
              </div>
            ))
          : data?.images.map((image) => (
              <div
                key={image.public_id}
                className={cn(
                  "aspect-square relative overflow-hidden rounded-lg group cursor-pointer",
                  selectedImages.has(image.public_id) && "ring-2 ring-primary"
                )}
                onClick={() => toggleImageSelection(image.public_id)}
              >
                <div className="absolute top-2 left-2 z-10">
                  <Checkbox
                    checked={selectedImages.has(image.public_id)}
                    className="bg-white/90 border-2"
                  />
                </div>
                <CldImage
                  src={image.public_id}
                  fill
                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 33vw, 25vw"
                  className="object-cover"
                  alt="Photo du mariage"
                />
                <div className="absolute bottom-0 left-0 right-0 p-2 bg-black/50 text-white text-xs opacity-0 group-hover:opacity-100 transition-opacity">
                  {new Date(image.created_at).toLocaleDateString("fr-FR")}
                </div>
              </div>
            ))}
      </div>

      {data && data.totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <Button
            variant="outline"
            onClick={() => setCursor(null)}
            disabled={!cursor}
          >
            Précédent
          </Button>
          <Button
            variant="outline"
            onClick={() => setCursor(data.nextCursor)}
            disabled={!data.nextCursor}
          >
            Suivant
          </Button>
        </div>
      )}
    </>
  );
}

function LoginForm() {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      code: "",
    },
  });

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    await signIn("credentials", {
      code: values.code,
      redirect: false,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <Card className="w-[350px]">
        <CardHeader>
          <h2 className="text-2xl font-bold text-center">Accès aux Photos</h2>
          <p className="text-sm text-muted-foreground text-center">
            Veuillez scanner le QR code reçu ou entrer le code d&apos;accès
          </p>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="Code d'accès"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full">
                Accéder aux photos
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}

export default function Home() {
  const { data: session } = useSession();

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Photos du Mariage</h1>
        <Suspense fallback={<div>Chargement...</div>}>
          {session ? <PhotoGallery /> : <LoginForm />}
        </Suspense>
      </div>
    </main>
  );
}
