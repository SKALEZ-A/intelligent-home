import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Card,
  CardContent,
  Grid,
  Typography,
  Button,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  IconButton,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Switch,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Stepper,
  Step,
  StepLabel,
  Alert,
  Divider,
  Paper,
  Tooltip,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  ExpandMore as ExpandMoreIcon,
  Schedule as ScheduleIcon,
  Devices as DevicesIcon,
  LocationOn as LocationIcon,
  WbSunny as WeatherIcon,
  PlayArrow as PlayIcon,
  Save as SaveIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import { useAppDispatch, useAppSelector } from '../../hooks/redux';
import {
  createAutomation,
  updateAutomation,
  deleteAutomation,
  testAutomation,
  selectAutomations,
  selectDevices,
  selectScenes,
} from '../../store/slices/automationSlice';
import { Automation, Trigger, Condition, Action } from '../../types';

interface AutomationBuilderProps {
  automationId?: string;
  onClose: () => void;
  onSave: (automation: Automation) => void;
}

const TRIGGER_TYPES = [
  { value: 'time', label: 'Time', icon: <ScheduleIcon /> },
  { value: 'device', label: 'Device State', icon: <DevicesIcon /> },
  { value: 'sensor', label: 'Sensor Value', icon: <DevicesIcon /> },
  { value: 'location', label: 'Location', icon: <LocationIcon /> },
  { value: 'weather', label: 'Weather', icon: <WeatherIcon /> },
  { value: 'sunrise', label: 'Sunrise', icon: <WbSunny /> },
  { value: 'sunset', label: 'Sunset', icon: <WbSunny /> },
];

const ACTION_TYPES = [
  { value: 'device', label: 'Control Device' },
  { value: 'scene', label: 'Activate Scene' },
  { value: 'notification', label: 'Send Notification' },
  { value: 'webhook', label: 'Call Webhook' },
  { value: 'delay', label: 'Wait/Delay' },
];

const CONDITION_OPERATORS = [
  { value: 'and', label: 'AND' },
  { value: 'or', label: 'OR' },
  { value: 'not', label: 'NOT' },
];

const COMPARISON_OPERATORS = [
  { value: 'eq', label: 'Equals' },
  { value: 'ne', label: 'Not Equals' },
  { value: 'gt', label: 'Greater Than' },
  { value: 'lt', label: 'Less Than' },
  { value: 'gte', label: 'Greater or Equal' },
  { value: 'lte', label: 'Less or Equal' },
  { value: 'contains', label: 'Contains' },
];

const AutomationBuilder: React.FC<AutomationBuilderProps> = ({
  automationId,
  onClose,
  onSave,
}) => {
  const dispatch = useAppDispatch();
  const devices = useAppSelector(selectDevices);
  const scenes = useAppSelector(selectScenes);
  const existingAutomation = useAppSelector((state) =>
    automationId ? selectAutomations(state).find((a) => a.id === automationId) : null
  );

  const [activeStep, setActiveStep] = useState(0);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [priority, setPriority] = useState(0);
  const [mode, setMode] = useState<'single' | 'restart' | 'queued' | 'parallel'>('single');
  const [triggers, setTriggers] = useState<Trigger[]>([]);
  const [conditions, setConditions] = useState<Condition[]>([]);
  const [actions, setActions] = useState<Action[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [triggerDialogOpen, setTriggerDialogOpen] = useState(false);
  const [conditionDialogOpen, setConditionDialogOpen] = useState(false);
  const [actionDialogOpen, setActionDialogOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  useEffect(() => {
    if (existingAutomation) {
      setName(existingAutomation.name);
      setDescription(existingAutomation.description);
      setEnabled(existingAutomation.enabled);
      setPriority(existingAutomation.priority);
      setMode(existingAutomation.mode);
      setTriggers(existingAutomation.triggers);
      setConditions(existingAutomation.conditions);
      setActions(existingAutomation.actions);
    }
  }, [existingAutomation]);

  const steps = ['Basic Info', 'Triggers', 'Conditions', 'Actions', 'Review'];

  const handleNext = () => {
    if (validateStep(activeStep)) {
      setActiveStep((prev) => prev + 1);
    }
  };

  const handleBack = () => {
    setActiveStep((prev) => prev - 1);
  };

  const validateStep = (step: number): boolean => {
    const newErrors: Record<string, string> = {};

    switch (step) {
      case 0:
        if (!name.trim()) {
          newErrors.name = 'Name is required';
        }
        break;
      case 1:
        if (triggers.length === 0) {
          newErrors.triggers = 'At least one trigger is required';
        }
        break;
      case 3:
        if (actions.length === 0) {
          newErrors.actions = 'At least one action is required';
        }
        break;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateStep(activeStep)) return;

    const automation: Partial<Automation> = {
      name,
      description,
      enabled,
      priority,
      mode,
      triggers,
      conditions,
      actions,
    };

    try {
      if (automationId) {
        await dispatch(updateAutomation({ id: automationId, ...automation })).unwrap();
      } else {
        await dispatch(createAutomation(automation)).unwrap();
      }
      onSave(automation as Automation);
      onClose();
    } catch (error) {
      console.error('Failed to save automation:', error);
    }
  };

  const handleTest = async () => {
    try {
      await dispatch(testAutomation(automationId!)).unwrap();
      alert('Automation test executed successfully');
    } catch (error) {
      console.error('Failed to test automation:', error);
      alert('Automation test failed');
    }
  };

  // Trigger Management
  const handleAddTrigger = (trigger: Trigger) => {
    if (editingIndex !== null) {
      const newTriggers = [...triggers];
      newTriggers[editingIndex] = trigger;
      setTriggers(newTriggers);
      setEditingIndex(null);
    } else {
      setTriggers([...triggers, trigger]);
    }
    setTriggerDialogOpen(false);
  };

  const handleEditTrigger = (index: number) => {
    setEditingIndex(index);
    setTriggerDialogOpen(true);
  };

  const handleDeleteTrigger = (index: number) => {
    setTriggers(triggers.filter((_, i) => i !== index));
  };

  // Condition Management
  const handleAddCondition = (condition: Condition) => {
    if (editingIndex !== null) {
      const newConditions = [...conditions];
      newConditions[editingIndex] = condition;
      setConditions(newConditions);
      setEditingIndex(null);
    } else {
      setConditions([...conditions, condition]);
    }
    setConditionDialogOpen(false);
  };

  const handleEditCondition = (index: number) => {
    setEditingIndex(index);
    setConditionDialogOpen(true);
  };

  const handleDeleteCondition = (index: number) => {
    setConditions(conditions.filter((_, i) => i !== index));
  };

  // Action Management
  const handleAddAction = (action: Action) => {
    if (editingIndex !== null) {
      const newActions = [...actions];
      newActions[editingIndex] = action;
      setActions(newActions);
      setEditingIndex(null);
    } else {
      setActions([...actions, action]);
    }
    setActionDialogOpen(false);
  };

  const handleEditAction = (index: number) => {
    setEditingIndex(index);
    setActionDialogOpen(true);
  };

  const handleDeleteAction = (index: number) => {
    setActions(actions.filter((_, i) => i !== index));
  };

  const handleDragEnd = (result: any) => {
    if (!result.destination) return;

    const items = Array.from(actions);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    setActions(items);
  };

  const renderStepContent = (step: number) => {
    switch (step) {
      case 0:
        return (
          <Box>
            <TextField
              fullWidth
              label="Automation Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              error={!!errors.name}
              helperText={errors.name}
              margin="normal"
              required
            />
            <TextField
              fullWidth
              label="Description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              margin="normal"
              multiline
              rows={3}
            />
            <Grid container spacing={2} mt={1}>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>Execution Mode</InputLabel>
                  <Select value={mode} onChange={(e) => setMode(e.target.value as any)} label="Execution Mode">
                    <MenuItem value="single">Single (Skip if running)</MenuItem>
                    <MenuItem value="restart">Restart (Cancel and restart)</MenuItem>
                    <MenuItem value="queued">Queued (Wait and execute)</MenuItem>
                    <MenuItem value="parallel">Parallel (Run simultaneously)</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  type="number"
                  label="Priority"
                  value={priority}
                  onChange={(e) => setPriority(parseInt(e.target.value))}
                  helperText="Higher priority automations execute first"
                />
              </Grid>
            </Grid>
            <Box mt={2}>
              <FormControl component="fieldset">
                <Box display="flex" alignItems="center">
                  <Typography>Enabled</Typography>
                  <Switch checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
                </Box>
              </FormControl>
            </Box>
          </Box>
        );

      case 1:
        return (
          <Box>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
              <Typography variant="h6">Triggers</Typography>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => {
                  setEditingIndex(null);
                  setTriggerDialogOpen(true);
                }}
              >
                Add Trigger
              </Button>
            </Box>
            {errors.triggers && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {errors.triggers}
              </Alert>
            )}
            <List>
              {triggers.map((trigger, index) => (
                <Paper key={index} sx={{ mb: 1, p: 2 }}>
                  <Box display="flex" justifyContent="space-between" alignItems="center">
                    <Box>
                      <Typography variant="subtitle1">
                        {TRIGGER_TYPES.find((t) => t.value === trigger.type)?.label}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {JSON.stringify(trigger.config)}
                      </Typography>
                    </Box>
                    <Box>
                      <IconButton onClick={() => handleEditTrigger(index)}>
                        <EditIcon />
                      </IconButton>
                      <IconButton onClick={() => handleDeleteTrigger(index)}>
                        <DeleteIcon />
                      </IconButton>
                    </Box>
                  </Box>
                </Paper>
              ))}
            </List>
          </Box>
        );

      case 2:
        return (
          <Box>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
              <Typography variant="h6">Conditions (Optional)</Typography>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => {
                  setEditingIndex(null);
                  setConditionDialogOpen(true);
                }}
              >
                Add Condition
              </Button>
            </Box>
            <Alert severity="info" sx={{ mb: 2 }}>
              Conditions are optional. If no conditions are specified, the automation will execute whenever triggered.
            </Alert>
            <List>
              {conditions.map((condition, index) => (
                <Paper key={index} sx={{ mb: 1, p: 2 }}>
                  <Box display="flex" justifyContent="space-between" alignItems="center">
                    <Box>
                      <Typography variant="subtitle1">{condition.type}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        {condition.expression}
                      </Typography>
                    </Box>
                    <Box>
                      <IconButton onClick={() => handleEditCondition(index)}>
                        <EditIcon />
                      </IconButton>
                      <IconButton onClick={() => handleDeleteCondition(index)}>
                        <DeleteIcon />
                      </IconButton>
                    </Box>
                  </Box>
                </Paper>
              ))}
            </List>
          </Box>
        );

      case 3:
        return (
          <Box>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
              <Typography variant="h6">Actions</Typography>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => {
                  setEditingIndex(null);
                  setActionDialogOpen(true);
                }}
              >
                Add Action
              </Button>
            </Box>
            {errors.actions && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {errors.actions}
              </Alert>
            )}
            <DragDropContext onDragEnd={handleDragEnd}>
              <Droppable droppableId="actions">
                {(provided) => (
                  <List {...provided.droppableProps} ref={provided.innerRef}>
                    {actions.map((action, index) => (
                      <Draggable key={index} draggableId={`action-${index}`} index={index}>
                        {(provided) => (
                          <Paper
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                            sx={{ mb: 1, p: 2 }}
                          >
                            <Box display="flex" justifyContent="space-between" alignItems="center">
                              <Box>
                                <Typography variant="subtitle1">
                                  {index + 1}. {ACTION_TYPES.find((t) => t.value === action.type)?.label}
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                  {action.target}
                                </Typography>
                                {action.delay && (
                                  <Chip label={`Delay: ${action.delay}s`} size="small" sx={{ mt: 1 }} />
                                )}
                              </Box>
                              <Box>
                                <IconButton onClick={() => handleEditAction(index)}>
                                  <EditIcon />
                                </IconButton>
                                <IconButton onClick={() => handleDeleteAction(index)}>
                                  <DeleteIcon />
                                </IconButton>
                              </Box>
                            </Box>
                          </Paper>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </List>
                )}
              </Droppable>
            </DragDropContext>
          </Box>
        );

      case 4:
        return (
          <Box>
            <Typography variant="h6" gutterBottom>
              Review Automation
            </Typography>
            <Accordion defaultExpanded>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography>Basic Information</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Grid container spacing={2}>
                  <Grid item xs={12}>
                    <Typography variant="subtitle2" color="text.secondary">
                      Name
                    </Typography>
                    <Typography>{name}</Typography>
                  </Grid>
                  <Grid item xs={12}>
                    <Typography variant="subtitle2" color="text.secondary">
                      Description
                    </Typography>
                    <Typography>{description || 'No description'}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="subtitle2" color="text.secondary">
                      Mode
                    </Typography>
                    <Typography>{mode}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="subtitle2" color="text.secondary">
                      Priority
                    </Typography>
                    <Typography>{priority}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="subtitle2" color="text.secondary">
                      Status
                    </Typography>
                    <Chip label={enabled ? 'Enabled' : 'Disabled'} color={enabled ? 'success' : 'default'} size="small" />
                  </Grid>
                </Grid>
              </AccordionDetails>
            </Accordion>

            <Accordion>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography>Triggers ({triggers.length})</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <List>
                  {triggers.map((trigger, index) => (
                    <ListItem key={index}>
                      <ListItemText
                        primary={TRIGGER_TYPES.find((t) => t.value === trigger.type)?.label}
                        secondary={JSON.stringify(trigger.config)}
                      />
                    </ListItem>
                  ))}
                </List>
              </AccordionDetails>
            </Accordion>

            <Accordion>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography>Conditions ({conditions.length})</Typography>
              </AccordionSummary>
              <AccordionDetails>
                {conditions.length === 0 ? (
                  <Typography color="text.secondary">No conditions specified</Typography>
                ) : (
                  <List>
                    {conditions.map((condition, index) => (
                      <ListItem key={index}>
                        <ListItemText primary={condition.type} secondary={condition.expression} />
                      </ListItem>
                    ))}
                  </List>
                )}
              </AccordionDetails>
            </Accordion>

            <Accordion>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography>Actions ({actions.length})</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <List>
                  {actions.map((action, index) => (
                    <ListItem key={index}>
                      <ListItemText
                        primary={`${index + 1}. ${ACTION_TYPES.find((t) => t.value === action.type)?.label}`}
                        secondary={action.target}
                      />
                    </ListItem>
                  ))}
                </List>
              </AccordionDetails>
            </Accordion>
          </Box>
        );

      default:
        return null;
    }
  };

  return (
    <Dialog open fullScreen onClose={onClose}>
      <DialogTitle>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="h5">{automationId ? 'Edit' : 'Create'} Automation</Typography>
          <IconButton onClick={onClose}>
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>
      <DialogContent>
        <Box sx={{ width: '100%', maxWidth: 1200, mx: 'auto', py: 3 }}>
          <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
            {steps.map((label) => (
              <Step key={label}>
                <StepLabel>{label}</StepLabel>
              </Step>
            ))}
          </Stepper>

          <Card>
            <CardContent sx={{ minHeight: 400 }}>{renderStepContent(activeStep)}</CardContent>
          </Card>
        </Box>
      </DialogContent>
      <DialogActions>
        <Box display="flex" justifyContent="space-between" width="100%" px={2}>
          <Box>
            {automationId && (
              <Button startIcon={<PlayIcon />} onClick={handleTest}>
                Test
              </Button>
            )}
          </Box>
          <Box>
            <Button onClick={onClose}>Cancel</Button>
            {activeStep > 0 && (
              <Button onClick={handleBack} sx={{ ml: 1 }}>
                Back
              </Button>
            )}
            {activeStep < steps.length - 1 ? (
              <Button variant="contained" onClick={handleNext} sx={{ ml: 1 }}>
                Next
              </Button>
            ) : (
              <Button variant="contained" startIcon={<SaveIcon />} onClick={handleSave} sx={{ ml: 1 }}>
                Save
              </Button>
            )}
          </Box>
        </Box>
      </DialogActions>

      {/* Trigger Dialog */}
      <TriggerDialog
        open={triggerDialogOpen}
        trigger={editingIndex !== null ? triggers[editingIndex] : undefined}
        devices={devices}
        onClose={() => {
          setTriggerDialogOpen(false);
          setEditingIndex(null);
        }}
        onSave={handleAddTrigger}
      />

      {/* Condition Dialog */}
      <ConditionDialog
        open={conditionDialogOpen}
        condition={editingIndex !== null ? conditions[editingIndex] : undefined}
        devices={devices}
        onClose={() => {
          setConditionDialogOpen(false);
          setEditingIndex(null);
        }}
        onSave={handleAddCondition}
      />

      {/* Action Dialog */}
      <ActionDialog
        open={actionDialogOpen}
        action={editingIndex !== null ? actions[editingIndex] : undefined}
        devices={devices}
        scenes={scenes}
        onClose={() => {
          setActionDialogOpen(false);
          setEditingIndex(null);
        }}
        onSave={handleAddAction}
      />
    </Dialog>
  );
};

// Placeholder dialogs - these would be implemented separately
const TriggerDialog: React.FC<any> = ({ open, trigger, devices, onClose, onSave }) => {
  return <Dialog open={open} onClose={onClose}><DialogTitle>Add Trigger</DialogTitle></Dialog>;
};

const ConditionDialog: React.FC<any> = ({ open, condition, devices, onClose, onSave }) => {
  return <Dialog open={open} onClose={onClose}><DialogTitle>Add Condition</DialogTitle></Dialog>;
};

const ActionDialog: React.FC<any> = ({ open, action, devices, scenes, onClose, onSave }) => {
  return <Dialog open={open} onClose={onClose}><DialogTitle>Add Action</DialogTitle></Dialog>;
};

export default AutomationBuilder;
