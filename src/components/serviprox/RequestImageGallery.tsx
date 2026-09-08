import React, { useEffect, useState } from "react";
import { IonSpinner } from "@ionic/react";
import { api } from "../../services/api";
import type { ServiceRequestImage } from "../../types/serviprox";
import "./RequestImageGallery.css";

type LoadedImage = ServiceRequestImage & {
  objectUrl: string;
};

type RequestImageGalleryProps = {
  images: ServiceRequestImage[];
  emptyText?: string;
};

const RequestImageGallery: React.FC<RequestImageGalleryProps> = ({
  images,
  emptyText = "Sin fotos adjuntas.",
}) => {
  const [loadedImages, setLoadedImages] = useState<LoadedImage[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    const objectUrls: string[] = [];

    if (!images.length) {
      setLoadedImages([]);
      return () => undefined;
    }

    setLoading(true);
    Promise.all(
      images.map(async (image) => {
        const blob = await api.blob(image.image_url);
        const objectUrl = URL.createObjectURL(blob);
        objectUrls.push(objectUrl);
        return { ...image, objectUrl };
      })
    )
      .then((nextImages) => {
        if (active) setLoadedImages(nextImages);
      })
      .catch(() => {
        if (active) setLoadedImages([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
      objectUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [images]);

  if (!images.length) {
    return <p className="sp-muted">{emptyText}</p>;
  }

  if (loading) {
    return (
      <div className="sp-request-images-loading">
        <IonSpinner name="crescent" />
        <span>Cargando fotos...</span>
      </div>
    );
  }

  return (
    <div className="sp-request-images" aria-label="Fotos adjuntas a la solicitud">
      {loadedImages.map((image) => (
        <a
          href={image.objectUrl}
          target="_blank"
          rel="noreferrer"
          className="sp-request-image"
          key={image.id}
          aria-label="Abrir foto de la solicitud"
        >
          <img src={image.objectUrl} alt="Foto adjunta a la solicitud" loading="lazy" />
        </a>
      ))}
    </div>
  );
};

export default RequestImageGallery;
