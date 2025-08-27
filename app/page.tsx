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
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { RefreshCw } from "lucide-react";
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

function PhotoGallery({ showWelcome }: { showWelcome: boolean }) {
  const { data: session, status } = useSession();
  const queryClient = useQueryClient();
  const [cursor, setCursor] = useState<string | null>(null);
  const [selectedImages, setSelectedImages] = useState<Set<string>>(new Set());
  const [selectAll, setSelectAll] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStarted, setUploadStarted] = useState(false);

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

  // Polling de backup quand un upload est en cours
  useEffect(() => {
    if (!uploadStarted) return;

    console.log("🔄 Polling automatique démarré");
    const interval = setInterval(async () => {
      try {
        await refetch();
      } catch (error) {
        console.error("❌ Erreur polling:", error);
      }
    }, 3000); // Toutes les 3 secondes

    // Arrêter le polling après 30 secondes max
    const timeout = setTimeout(() => {
      console.log("⏹️ Arrêt automatique du polling");
      setUploadStarted(false);
      setIsUploading(false);
    }, 30000);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [uploadStarted, refetch]);

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

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
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

  const handleUpload = (result: unknown) => {
    console.log("✅ Upload terminé!", result);

    // Arrêter le polling puisque l'upload est terminé
    setUploadStarted(false);

    // Retourner à la première page
    setCursor(null);

    // Refetch final après 2 secondes
    setTimeout(async () => {
      try {
        await refetch();
        setIsUploading(false);
      } catch (error) {
        console.error("❌ Erreur refetch final:", error);
        setIsUploading(false);
      }
    }, 2000);
  };

  const handleUploadStart = () => {
    console.log("🚀 Upload commencé");
    setIsUploading(true);
    setUploadStarted(true);
    setCursor(null);
  };

  const handleManualRefresh = async () => {
    console.log("🔄 Rafraîchissement manuel");
    await queryClient.invalidateQueries({ queryKey: ["images"] });
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
      {/* Message de bienvenue pour QR code */}
      {showWelcome && (
        <div className="mb-8 p-6 bg-gradient-to-r from-pink-100 via-rose-50 to-pink-100 border border-pink-200 rounded-2xl shadow-lg backdrop-blur-sm">
          <div className="text-center">
            <h3 className="font-bold text-xl text-pink-800 mb-2">
              Bienvenue dans notre album de mariage !
            </h3>
            <p className="text-pink-600 text-base font-medium">
              Vous êtes connecté automatiquement. Découvrez nos plus beaux
              moments !
            </p>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-4 mb-10 sm:flex-row sm:justify-between sm:items-center">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <CldUploadButton
            onUpload={handleUpload}
            onOpen={handleUploadStart}
            uploadPreset="qzsedazf"
            options={{
              tags: ["mariage"],
            }}
            className="bg-gradient-to-r from-pink-500 to-rose-500 text-white px-6 py-3 rounded-full font-semibold shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-200 w-full sm:w-auto"
          >
            Ajouter des photos
          </CldUploadButton>

          <Button
            variant="outline"
            onClick={handleManualRefresh}
            className="flex items-center gap-2 w-full sm:w-auto border-pink-300 text-pink-700 hover:bg-pink-50 hover:border-pink-400 rounded-full px-6 py-3 font-medium shadow-md hover:shadow-lg transition-all duration-200"
            disabled={isUploading || isLoading}
          >
            <RefreshCw className="w-4 h-4" />
            Actualiser
          </Button>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <Button
            variant="outline"
            onClick={handleSelectAll}
            className="w-full sm:w-auto border-rose-300 text-rose-700 hover:bg-rose-50 hover:border-rose-400 rounded-full px-6 py-3 font-medium shadow-md hover:shadow-lg transition-all duration-200"
          >
            {selectAll ? "Désélectionner tout" : "Sélectionner tout"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6 mb-10">
        {isLoading
          ? Array.from({ length: 8 }).map((_, index) => (
              <div
                key={index}
                className="aspect-square relative overflow-hidden rounded-2xl shadow-lg"
              >
                <Skeleton className="w-full h-full bg-gradient-to-br from-pink-100 to-rose-100" />
                <div className="absolute inset-0 bg-gradient-to-t from-pink-200/30 to-transparent"></div>
              </div>
            ))
          : data?.images.map((image) => (
              <div
                key={image.public_id}
                className={cn(
                  "aspect-square relative overflow-hidden rounded-2xl group cursor-pointer shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:scale-105",
                  selectedImages.has(image.public_id)
                    ? "ring-4 ring-pink-400 ring-offset-2 shadow-pink-200"
                    : "hover:ring-2 hover:ring-pink-300"
                )}
                onClick={() => toggleImageSelection(image.public_id)}
              >
                <div className="absolute top-3 left-3 z-10">
                  <div
                    className={cn(
                      "rounded-full p-1 backdrop-blur-sm transition-all duration-200",
                      selectedImages.has(image.public_id)
                        ? "bg-pink-500/90"
                        : "bg-white/90 hover:bg-pink-100/90"
                    )}
                  >
                    <Checkbox
                      checked={selectedImages.has(image.public_id)}
                      className="border-2 data-[state=checked]:bg-white data-[state=checked]:text-pink-500"
                    />
                  </div>
                </div>
                <CldImage
                  src={image.public_id}
                  fill
                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 33vw, 25vw"
                  className="object-cover transition-transform duration-300 group-hover:scale-110"
                  alt="Photo du mariage"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                <div className="absolute bottom-0 left-0 right-0 p-4 text-white transform translate-y-full group-hover:translate-y-0 transition-transform duration-300">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">
                      {new Date(image.created_at).toLocaleDateString("fr-FR")}
                    </span>
                  </div>
                </div>
              </div>
            ))}
      </div>

      {data && data.totalPages > 1 && (
        <div className="flex justify-center gap-4 mt-8">
          <Button
            variant="outline"
            onClick={() => setCursor(null)}
            disabled={!cursor}
            className="border-pink-300 text-pink-700 hover:bg-pink-50 hover:border-pink-400 rounded-full px-8 py-3 font-medium shadow-md hover:shadow-lg transition-all duration-200 disabled:opacity-50"
          >
            ← Précédent
          </Button>
          <Button
            variant="outline"
            onClick={() => setCursor(data.nextCursor)}
            disabled={!data.nextCursor}
            className="border-rose-300 text-rose-700 hover:bg-rose-50 hover:border-rose-400 rounded-full px-8 py-3 font-medium shadow-md hover:shadow-lg transition-all duration-200 disabled:opacity-50"
          >
            Suivant →
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
    <div className="fixed inset-0 bg-gradient-to-br from-pink-500/20 via-rose-400/20 to-red-400/20 backdrop-blur-lg flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-md shadow-2xl border-0 bg-white/95 backdrop-blur-sm">
        <CardHeader className="text-center pb-6">
          <h2 className="text-3xl font-bold bg-gradient-to-r from-pink-600 to-rose-600 bg-clip-text text-transparent mb-2">
            Accès aux Photos
          </h2>
          <h3 className="text-xl font-script text-gray-600 mb-3">
            Emilie & Seb
          </h3>
          <p className="text-sm text-gray-600 leading-relaxed">
            Veuillez scanner le QR code reçu ou entrer le code d&apos;accès pour
            découvrir nos plus beaux souvenirs
          </p>
          <div className="mt-4 w-16 h-1 bg-gradient-to-r from-pink-400 to-rose-400 mx-auto rounded-full"></div>
        </CardHeader>
        <CardContent className="pt-0">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="Code d'accès"
                        className="text-center text-lg py-6 rounded-2xl border-2 border-pink-200 focus:border-pink-400 focus:ring-4 focus:ring-pink-100 bg-gradient-to-r from-pink-50 to-rose-50"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage className="text-center" />
                  </FormItem>
                )}
              />
              <Button
                type="submit"
                className="w-full bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white font-semibold py-6 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105"
              >
                Accéder aux photos du mariage
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}

function AuthHandler() {
  const { data: session, status } = useSession();
  const searchParams = useSearchParams();
  const code = searchParams.get("code");
  const [isAutoAuthenticating, setIsAutoAuthenticating] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);

  useEffect(() => {
    if (code && !session && status !== "loading") {
      console.log("🔑 Tentative de connexion automatique avec le code:", code);
      setIsAutoAuthenticating(true);

      signIn("credentials", {
        code: code,
        redirect: false,
      })
        .then((result) => {
          console.log("Résultat de l'authentification:", result);

          if (result?.ok) {
            console.log("✅ Authentification réussie via QR code");
            setShowWelcome(true);

            // Masquer le message de bienvenue après 4 secondes
            setTimeout(() => {
              setShowWelcome(false);
            }, 4000);
          } else {
            console.log("❌ Échec de l'authentification automatique");
          }

          setIsAutoAuthenticating(false);
        })
        .catch((error) => {
          console.error("❌ Erreur lors de l'authentification:", error);
          setIsAutoAuthenticating(false);
        });
    }
  }, [code, session, status]);

  if (session) {
    return <PhotoGallery showWelcome={showWelcome} />;
  }

  if (isAutoAuthenticating) {
    return (
      <div className="flex items-center justify-center min-h-[500px]">
        <div className="text-center bg-white/80 backdrop-blur-sm rounded-3xl p-12 shadow-xl border border-pink-100">
          <div className="relative mb-6">
            <div className="animate-spin rounded-full h-16 w-16 border-4 border-pink-200 border-t-pink-500 mx-auto"></div>
            <div className="absolute inset-0 rounded-full bg-gradient-to-r from-pink-400 to-rose-400 opacity-20 animate-pulse"></div>
          </div>
          <p className="text-2xl font-bold text-pink-700 mb-2">
            Connexion en cours...
          </p>
          <p className="text-lg text-gray-600 font-medium">
            Authentification via QR code
          </p>
          <div className="mt-6 w-32 h-1 bg-gradient-to-r from-pink-400 to-rose-400 mx-auto rounded-full animate-pulse"></div>
        </div>
      </div>
    );
  }

  return <LoginForm />;
}

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-rose-50">
      <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg%20width=%2260%22%20height=%2260%22%20viewBox=%220%200%2060%2060%22%20xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cg%20fill=%22none%22%20fill-rule=%22evenodd%22%3E%3Cg%20fill=%22%23fce7f3%22%20fill-opacity=%220.4%22%3E%3Ccircle%20cx=%2230%22%20cy=%2230%22%20r=%221%22/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')] opacity-30"></div>

      <div className="relative z-10 p-6 md:p-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-pink-600 via-rose-500 to-red-500 bg-clip-text text-transparent mb-4">
              Photos du Mariage
            </h1>
            <h2 className="text-2xl md:text-3xl font-script text-gray-700 mb-4">
              Emilie & Seb
            </h2>
            <p className="text-lg text-gray-600 font-medium">
              Partagez vos plus beaux souvenirs
            </p>
            <div className="mt-6 w-24 h-1 bg-gradient-to-r from-pink-400 to-rose-400 mx-auto rounded-full"></div>
          </div>

          <Suspense
            fallback={
              <div className="flex items-center justify-center min-h-[400px]">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-4 border-pink-200 border-t-pink-500 mx-auto mb-4"></div>
                  <p className="text-lg font-medium text-gray-700">
                    Chargement des merveilles...
                  </p>
                </div>
              </div>
            }
          >
            <AuthHandler />
          </Suspense>
        </div>
      </div>
    </main>
  );
}
