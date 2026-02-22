import React, { useState, useMemo } from 'react';
import {
  Box,
  Button,
  Typography,
  Popover,
  Tabs,
  Tab,
  TextField,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Checkbox,
  Chip,
  InputAdornment,
  Stack,
  CircularProgress
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import CheckBoxOutlineBlankIcon from '@mui/icons-material/CheckBoxOutlineBlank';
import CheckBoxIcon from '@mui/icons-material/CheckBox';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';

const LEVELS = [
  { id: '1', label: 'Level 1' },
  { id: '2', label: 'Level 2' },
  { id: '3', label: 'Level 3' },
  { id: '4', label: 'Level 4' },
];

const MetricSelector = ({ 
  metrics = [], 
  selectedMetrics = [], 
  onToggleMetric, 
  maxSelection = 3,
  // New props for Level 3 support
  activeLevel = '1',
  onLevelChange,
  level3Categories = [],
  selectedLevel3Category = null,
  onLevel3CategoryChange,
  isLoadingLevel3 = false
}) => {
  const [anchorEl, setAnchorEl] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  const open = Boolean(anchorEl);

  const handleClick = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  // Filter metrics based on search and level
  const filteredMetrics = useMemo(() => {
    return metrics.filter(metric => {
      const matchSearch = metric.label.toLowerCase().includes(searchQuery.toLowerCase());
      // If we are in Level 3, we assume the parent passed only level 3 metrics for the selected category
      // For other levels, we might need filtering if all metrics were passed at once
      // But based on the NEW plan, ReportGenerator will pass the CORRECT metrics list based on level/category
      // So we just filter by search here.
      return matchSearch;
    });
  }, [metrics, searchQuery]);

  const handleToggle = (metricKey) => {
    onToggleMetric(metricKey);
  };

  return (
    <>
      <Button
        variant="outlined"
        onClick={handleClick}
        endIcon={<ArrowDropDownIcon />}
        sx={{
          borderRadius: '20px',
          textTransform: 'none',
          borderColor: '#E0E0E0',
          color: '#333',
          bgcolor: 'white',
          padding: '6px 16px',
          fontWeight: 500,
          '&:hover': {
            borderColor: '#BDBDBD',
            bgcolor: '#F5F5F5'
          }
        }}
      >
        {selectedMetrics.length === 0 
          ? "Select Metrics" 
          : `${selectedMetrics.length} Selected`}
      </Button>

      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{
            vertical: 'bottom',
            horizontal: 'right', // Align to right so it doesn't go off screen
        }}
        transformOrigin={{
            vertical: 'top',
            horizontal: 'right',
        }}
        PaperProps={{
            sx: {
                width: 400,
                maxHeight: 600,
                borderRadius: 2,
                mt: 1,
                boxShadow: '0px 4px 20px rgba(0,0,0,0.1)'
            }
        }}
      >
        <Box sx={{ p: 2, borderBottom: '1px solid #eee' }}>
            <Typography variant="subtitle2" color="primary" sx={{ mb: 1.5, fontWeight: 600 }}>
                Select Metrics
            </Typography>
            
            {/* Level Tabs */}
            <Tabs
                value={activeLevel}
                onChange={(e, v) => onLevelChange && onLevelChange(v)}
                variant="fullWidth"
                sx={{
                    minHeight: 36,
                    mb: 1,
                    '& .MuiTab-root': {
                        minHeight: 36,
                        textTransform: 'none',
                        fontSize: '0.9rem',
                        fontWeight: 500,
                        color: '#666',
                        bgcolor: '#F8F9FA',
                        margin: '0 2px',
                        borderRadius: 1,
                        '&.Mui-selected': {
                            color: 'white',
                            bgcolor: '#1F559B'
                        }
                    },
                    '& .MuiTabs-indicator': { display: 'none' }
                }}
            >
                {LEVELS.map(level => (
                    <Tab key={level.id} label={level.label} value={level.id} />
                ))}
            </Tabs>

             {/* Level 3 Categories (Horizontal Scroll) */}
             {activeLevel === '3' && (
                <Box sx={{ 
                    display: 'flex', 
                    gap: 1, 
                    overflowX: 'auto', 
                    pb: 1,
                    mb: 1,
                    '&::-webkit-scrollbar': { height: 4 },
                    '&::-webkit-scrollbar-thumb': { bgcolor: '#ccc', borderRadius: 2 }
                }}>
                    {level3Categories.map(cat => (
                         <Chip
                            key={cat}
                            label={cat}
                            onClick={() => onLevel3CategoryChange && onLevel3CategoryChange(cat)}
                            color={selectedLevel3Category === cat ? "primary" : "default"}
                            variant={selectedLevel3Category === cat ? "filled" : "outlined"}
                            size="small"
                            sx={{ cursor: 'pointer' }}
                         />
                    ))}
                </Box>
             )}
        </Box>

        <Box sx={{ p: 2 }}>
            {/* Selected Chips */}
            {selectedMetrics.length > 0 && (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
                    {selectedMetrics.map(key => {
                        // Try to find label in current metrics list, but if not found (e.g. switched level), show key
                        const label = metrics.find(m => m.key === key)?.label || key;
                        return (
                            <Chip
                                key={key}
                                label={label}
                                onDelete={() => handleToggle(key)}
                                size="small"
                                variant="outlined"
                                color="primary"
                            />
                        );
                    })}
                </Box>
            )}

            {/* Search */}
            <TextField
                fullWidth
                placeholder="Search metrics..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                size="small"
                InputProps={{
                    startAdornment: (
                        <InputAdornment position="start">
                            <SearchIcon sx={{ color: '#999' }} />
                        </InputAdornment>
                    ),
                    sx: { borderRadius: 1, bgcolor: '#F8F9FA' }
                }}
                disabled={activeLevel === '3' && !selectedLevel3Category}
                sx={{ mb: 1 }}
            />

            {/* Metrics List */}
            {isLoadingLevel3 ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                    <CircularProgress size={24} />
                </Box>
            ) : (
                <List sx={{ maxHeight: 300, overflow: 'auto' }}>
                    {activeLevel === '3' && !selectedLevel3Category ? (
                         <ListItem>
                            <ListItemText 
                                primary={<Typography variant="body2" color="text.secondary" align="center">Select a category to view metrics.</Typography>} 
                            />
                        </ListItem>
                    ) : filteredMetrics.length === 0 ? (
                        <ListItem>
                            <ListItemText 
                                primary={<Typography variant="body2" color="text.secondary" align="center">No metrics available.</Typography>} 
                            />
                        </ListItem>
                    ) : (
                        filteredMetrics.map((metric) => {
                            const isSelected = selectedMetrics.includes(metric.key);
                            const isDisabled = !isSelected && selectedMetrics.length >= maxSelection;

                            return (
                                <ListItem key={metric.key} disablePadding>
                                    <ListItemButton 
                                        onClick={() => handleToggle(metric.key)}
                                        disabled={isDisabled}
                                        dense
                                    >
                                        <ListItemText 
                                            primary={metric.label} 
                                            primaryTypographyProps={{ 
                                                variant: 'body2', 
                                                color: isDisabled ? 'text.disabled' : 'text.primary' 
                                            }}
                                        />
                                        <ListItemIcon sx={{ minWidth: 0 }}>
                                            <Checkbox
                                                edge="end"
                                                checked={isSelected}
                                                tabIndex={-1}
                                                disableRipple
                                                icon={<CheckBoxOutlineBlankIcon />}
                                                checkedIcon={<CheckBoxIcon />}
                                                sx={{ p: 0.5 }}
                                            />
                                        </ListItemIcon>
                                    </ListItemButton>
                                </ListItem>
                            );
                        })
                    )}
                </List>
            )}
        </Box>
      </Popover>
    </>
  );
};

export default MetricSelector;
