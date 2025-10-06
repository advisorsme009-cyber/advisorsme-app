import React, { useState } from "react";
import {
  Box,
  Typography,
  Card,
  CardContent,
  CardActions,
  IconButton,
  Collapse,
  Button,
  CircularProgress,
  Icon,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { styled } from "@mui/material/styles";

// Styled component for the expand icon rotation.
// This allows the icon to rotate when the card is expanded,
// providing a visual cue to the user.
const ExpandMore = styled((props) => {
  const { expand, ...other } = props;
  return <IconButton {...other} />;
})(({ theme, expand }) => ({
  transform: !expand ? "rotate(0deg)" : "rotate(180deg)", // Rotate 180deg when expanded
  marginLeft: "auto", // Push the icon to the right
  transition: theme.transitions.create("transform", {
    // Smooth transition for rotation
    duration: theme.transitions.duration.shortest,
  }),
}));

/**
 * A standalone React component that displays a message within an expandable card.
 * It includes actions to show or hide a "thinking" section.
 *
 * @param {object} props - The component props.
 * @param {string} props.msg - The main message content to be displayed in the card.
 * @param {string} [props.title="Message Card"] - The title for the card header.
 */
export function ExpandableMessageCard({
  msg,
  isThinking,
  title = "Message Card",
}) {
  // State to manage the expanded/collapsed state of the "thinking" section.
  const [expanded, setExpanded] = useState(false);

  // Handler for toggling the expanded state.
  const handleExpandClick = () => {
    setExpanded(!expanded);
  };

  return (
    // The main card container with Tailwind CSS classes for styling.
    // max-w-md: sets a maximum width for responsiveness.
    // mx-auto: centers the card horizontally.
    // my-4: adds vertical margin.
    // rounded-lg: applies rounded corners.
    // shadow-lg: adds a large shadow for depth.
    <Card className="max-w-md mx-auto my-4 rounded-lg shadow-lg">
      <CardActions
        disableSpacing
        className="flex justify-between items-center px-4 py-2 bg-gray-50 border-t border-gray-200"
      >
        {/* Button to toggle the "thinking" section visibility */}
        <Box>
          {isThinking && <CircularProgress size={24} color="red" />}

          <Button
            onClick={handleExpandClick}
            className="text-blue-600 hover:text-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 rounded-md px-3 py-1 transition duration-150 ease-in-out"
          >
            {expanded ? "Hide Thinking" : "Show Thinking"}
          </Button>
        </Box>
        {/* IconButton with the ExpandMore styled component for visual toggle */}
        <ExpandMore
          expand={expanded}
          onClick={handleExpandClick}
          aria-expanded={expanded} // Accessibility attribute
          aria-label="show more" // Accessibility label
          className="text-gray-600 hover:text-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-opacity-50 rounded-full p-2"
        >
          <Icon sx={{ color: "#000000", fontSize: 40 }}> expand_more_icon</Icon>
        </ExpandMore>
      </CardActions>
      {/* Collapse component to animate the expansion/contraction of the "thinking" content */}
      <Collapse in={expanded} timeout="auto" unmountOnExit>
        <CardContent className="bg-gray-100 p-4 border-t border-gray-200">
          {/* Placeholder content for the "thinking" section */}

          <Typography variant="body1" color="text.secondary" className="mt-2">
            {msg}
          </Typography>
        </CardContent>
      </Collapse>
    </Card>
  );
}
