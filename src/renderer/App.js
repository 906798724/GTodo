"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const react_1 = __importStar(require("react"));
const core_1 = require("@dnd-kit/core");
const sortable_1 = require("@dnd-kit/sortable");
const TaskColumn_1 = require("./components/TaskColumn");
const TaskCard_1 = require("./components/TaskCard");
const TaskModal_1 = require("./components/TaskModal");
const types_1 = require("./types");
require("./styles/main.css");
const App = () => {
    const [tasks, setTasks] = (0, react_1.useState)([]);
    const [selectedTask, setSelectedTask] = (0, react_1.useState)(null);
    const [activeId, setActiveId] = (0, react_1.useState)(null);
    const [isModalOpen, setIsModalOpen] = (0, react_1.useState)(false);
    const [editingTask, setEditingTask] = (0, react_1.useState)(null);
    const sensors = (0, core_1.useSensors)((0, core_1.useSensor)(core_1.PointerSensor, {
        activationConstraint: {
            distance: 8,
        },
    }));
    (0, react_1.useEffect)(() => {
        loadTasks();
        window.electronAPI.onTasksUpdated(loadTasks);
    }, []);
    const loadTasks = async () => {
        try {
            const loadedTasks = await window.electronAPI.getTasks();
            setTasks(loadedTasks);
        }
        catch (error) {
            console.error('Failed to load tasks:', error);
        }
    };
    const handleDragStart = (event) => {
        const task = tasks.find((t) => t.id === event.active.id);
        if (task) {
            setSelectedTask(task);
            setActiveId(task.id);
        }
    };
    const handleDragEnd = (event) => {
        const { active, over } = event;
        setActiveId(null);
        setSelectedTask(null);
        if (!over)
            return;
        const activeTask = tasks.find((t) => t.id === active.id);
        if (!activeTask)
            return;
        const overId = over.id;
        const overTask = tasks.find((t) => t.id === overId);
        const overColumn = types_1.COLUMNS.find((c) => c.id === overId);
        let newStatus = activeTask.status;
        if (overColumn) {
            newStatus = overColumn.id;
        }
        else if (overTask) {
            newStatus = overTask.status;
        }
        if (newStatus !== activeTask.status) {
            const updatedTask = {
                id: activeTask.id,
                status: newStatus,
                completed_at: newStatus === 'done' ? new Date().toISOString() : null,
            };
            window.electronAPI.updateTask(updatedTask).then(loadTasks);
        }
        else {
            const tasksInColumn = tasks.filter((t) => t.status === activeTask.status);
            const oldIndex = tasksInColumn.findIndex((t) => t.id === active.id);
            const newIndex = overTask ? tasksInColumn.findIndex((t) => t.id === overTask.id) : tasksInColumn.length - 1;
            if (oldIndex !== newIndex) {
                const reordered = (0, sortable_1.arrayMove)(tasksInColumn, oldIndex, newIndex);
                reordered.forEach((t, index) => {
                    window.electronAPI.updateTask({ id: t.id });
                });
            }
        }
    };
    const handleEdit = (task) => {
        setEditingTask(task);
        setIsModalOpen(true);
    };
    const handleDelete = async (id) => {
        if (confirm('确定要删除这个任务吗？')) {
            await window.electronAPI.deleteTask(id);
            loadTasks();
        }
    };
    const handleSave = async (taskData) => {
        if ('id' in taskData && taskData.id) {
            await window.electronAPI.updateTask(taskData);
        }
        else {
            await window.electronAPI.createTask(taskData);
        }
        loadTasks();
    };
    const getTasksByStatus = (status) => {
        return tasks.filter((t) => t.status === status && t.parent_id === null);
    };
    return (react_1.default.createElement("div", { className: "app-container" },
        react_1.default.createElement("header", { className: "header" },
            react_1.default.createElement("div", { className: "header-title" },
                react_1.default.createElement("span", null, "\uD83D\uDCCB"),
                react_1.default.createElement("h1", null, "GTodo")),
            react_1.default.createElement("div", { className: "header-shortcut" },
                react_1.default.createElement("span", null, "\u5FEB\u901F\u6DFB\u52A0\u4EFB\u52A1:"),
                react_1.default.createElement("kbd", null, "Ctrl"),
                react_1.default.createElement("span", null, "+"),
                react_1.default.createElement("kbd", null, "Shift"),
                react_1.default.createElement("span", null, "+"),
                react_1.default.createElement("kbd", null, "B"))),
        react_1.default.createElement(core_1.DndContext, { sensors: sensors, collisionDetection: core_1.closestCorners, onDragStart: handleDragStart, onDragEnd: handleDragEnd },
            react_1.default.createElement("div", { className: "boards-container" }, types_1.COLUMNS.map((column) => (react_1.default.createElement(TaskColumn_1.TaskColumn, { key: column.id, column: column, tasks: getTasksByStatus(column.id), onEdit: handleEdit, onDelete: handleDelete })))),
            react_1.default.createElement(core_1.DragOverlay, null, activeId && selectedTask ? (react_1.default.createElement("div", { style: { opacity: 0.9 } },
                react_1.default.createElement(TaskCard_1.TaskCard, { task: selectedTask, onEdit: () => { }, onDelete: () => { } }))) : null)),
        isModalOpen && (react_1.default.createElement(TaskModal_1.TaskModal, { task: editingTask, onClose: () => {
                setIsModalOpen(false);
                setEditingTask(null);
            }, onSave: handleSave }))));
};
exports.default = App;
