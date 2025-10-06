/* eslint-disable react/prop-types */
import React, { useState, useEffect } from "react";
import {
  Grid,
  Card,
  CardMedia,
  CardActions,
  IconButton,
  CircularProgress,
  Box,
  Typography,
  CardContent,
  Icon,
  Button,
  Stack,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import ImageDialog from "./ZoomDialog";
import { apiUrl } from "../hooks/api";

const PdfPreviewGrid = ({ file, pages, setPages }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleDelete = (idx) => {
    setPages((prev) => prev.filter((_, i) => i !== idx));
  };

  useEffect(() => {
    if (!file) return;

    const fetchPages = async () => {
      setLoading(true);
      setError(null);
      const formData = new FormData();
      formData.append("file", file);

      try {
        const res = await fetch(`${apiUrl}/split-pdf-to-images`, {
          method: "POST",
          body: formData,
        });
        if (!res.ok) {
          throw new Error(`Upload failed: ${res.statusText}`);
        }
        let data = await res.json();
        console.log(data);
        setPages(data);
      } catch (e) {
        console.error(e);
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };

    fetchPages();
  }, [file]);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" mt={4}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box mt={4} textAlign="center">
        <Typography color="error">Error: {error}</Typography>
      </Box>
    );
  }

  if (!pages.length) {
    return (
      <Box textAlign="center" mt={4}>
        <Typography color="text.secondary">No pages to display.</Typography>
      </Box>
    );
  }

  return (
    <Box>
      <Typography
        variant="h5"
        color="primary"
        gutterBottom
        sx={{ textAlign: "center" }}
      >
        PDF Preview
      </Typography>

      <Grid container spacing={2}>
        {pages.map((page, idx) => (
          <Grid item xs={12} sm={6} md={4} lg={4} key={idx}>
            <Card sx={{ position: "relative" }}>
              <CardMedia
                component="img"
                height="400"
                image={`data:image/png;base64,${page.image}`}
                alt={`Page ${idx + 1}`}
                sx={{ objectFit: "contain" }}
              />
              <CardActions
                disableSpacing
                sx={{
                  justifyContent: "center", // Center the icons horizontally
                  padding: 1, // Add some padding around the icons
                }}
              >
                <Stack direction="row" spacing={1}>
                  <ImageDialog imageData={pages[idx].image} />
                  <IconButton
                    size="small"
                    aria-label="delete page"
                    onClick={() => handleDelete(idx)}
                  >
                    <Icon sx={{ color: "red", m: 2 }}>delete_icon</Icon>
                  </IconButton>
                  <Typography>{pages[idx].page_number}</Typography>
                </Stack>
              </CardActions>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
};

export default PdfPreviewGrid;

// /* eslint-disable react/prop-types */
// import React, { useState, useEffect } from "react";
// import {
//   Grid,
//   Card,
//   CardMedia,
//   CardActions,
//   IconButton,
//   CircularProgress,
//   Box,
//   Typography,
//   CardContent,
//   Icon,
// } from "@mui/material";
// import DeleteIcon from "@mui/icons-material/Delete";

// const PdfPreviewGrid = ({ file, pages, setPages }) => {
//   const [loading, setLoading] = useState(false);
//   const [error, setError] = useState(null);

//   useEffect(() => {
//     if (!file) return;

//     const fetchPages = async () => {
//       setLoading(true);
//       setError(null);
//       const formData = new FormData();
//       formData.append("file", file);

//       try {
//         const res = await fetch("http://127.0.0.1:8000/split-pdf-to-images", {
//           method: "POST",
//           body: formData,
//         });
//         if (!res.ok) {
//           throw new Error(`Upload failed: ${res.statusText}`);
//         }
//         let data = await res.json();
//         console.log(data.pages);
//         setPages(data.pages);
//       } catch (e) {
//         console.error(e);
//         setError(e.message);
//       } finally {
//         setLoading(false);
//       }
//     };

//     fetchPages();
//   }, [file]);

//   if (loading) {
//     return (
//       <Box display="flex" justifyContent="center" mt={4}>
//         <CircularProgress />
//       </Box>
//     );
//   }

//   if (error) {
//     return (
//       <Box mt={4} textAlign="center">
//         <Typography color="error">Error: {error}</Typography>
//       </Box>
//     );
//   }

//   return (
//     <Box>
//       {pages.length !== 0 && (
//         <Typography marginBottom={5} variant="h5" color="primary.main">
//           PDF Viewer
//         </Typography>
//       )}
//       <Grid container spacing={2}>
//         {pages.map((src, idx) => (
//           <Grid item xs={12} sm={6} md={4} lg={3} key={idx}>
//             <Card sx={{ position: "relative" }}>
//               <CardContent sx={{ p: 0 }}>
//                 <iframe
//                   src={`data:image/png;base64,${src}`}
//                   title={`PDF page ${idx + 1}`}
//                   width="100%"
//                   height="240px"
//                   style={{ border: "none" }}
//                 />
//               </CardContent>
//               <CardActions
//                 sx={{
//                   position: "absolute",
//                   top: 4,
//                   right: 4,
//                   bgcolor: "rgba(255,255,255,0.7)",
//                   borderRadius: "50%",
//                 }}
//               >
//                 <IconButton
//                   size="small"
//                   aria-label="delete page"
//                   onClick={() => handleDelete(idx)}
//                 >
//                   <Icon sx={{ color: "red", fontSize: 24 }}> delete_icon</Icon>
//                 </IconButton>
//               </CardActions>
//             </Card>
//           </Grid>
//         ))}
//         {pages.length === 0 && !loading && (
//           <Grid item xs={12}>
//             <Typography align="center" color="textSecondary">
//               No pages to display.
//             </Typography>
//           </Grid>
//         )}
//       </Grid>
//     </Box>
//   );
// };

// export default PdfPreviewGrid;
