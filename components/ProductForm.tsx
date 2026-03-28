const uploadImages = async (
  files: File[],
  setter: React.Dispatch<React.SetStateAction<string[]>>
) => {
  if (!files.length) return;

  setUploadingImage(true);

  try {
    const uploads = files.map(async (file) => {
      const form = new FormData();
      form.append("file", file);

      const res = await apiAuthFetch("/api/upload", {
        method: "POST",
        body: form,
      });

      if (!res.ok) throw new Error("UPLOAD_FAILED");

      const data = await res.json();
      return data.url;
    });

    const urls = await Promise.all(uploads);

    setter((prev) => [...prev, ...urls]);

  } catch {
    setMessage({
      text: t.upload_failed,
      type: "error",
    });
  } finally {
    setUploadingImage(false);
  }
};
