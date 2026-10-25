import React, { useEffect, useState } from "react";
import { api } from "../../services/api";

// Conserva el mismo elemento y estilos; descarga la evidencia con JWT.
const AuthenticatedImage: React.FC<React.ImgHTMLAttributes<HTMLImageElement>> = ({ src, ...props }) => {
  const [objectUrl, setObjectUrl] = useState<string>();
  useEffect(() => {
    let active = true;
    let loadedUrl: string | undefined;
    setObjectUrl(undefined);
    if (src) {
      api.blob(src).then((blob) => {
        if (!active) return;
        loadedUrl = URL.createObjectURL(blob);
        setObjectUrl(loadedUrl);
      }).catch(() => { if (active) setObjectUrl(undefined); });
    }
    return () => {
      active = false;
      if (loadedUrl) URL.revokeObjectURL(loadedUrl);
    };
  }, [src]);
  return <img {...props} src={objectUrl} />;
};
export default AuthenticatedImage;
