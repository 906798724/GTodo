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
exports.TaskModal = void 0;
const react_1 = __importStar(require("react"));
const TaskModal = ({ task, onClose, onSave }) => {
    const [title, setTitle] = (0, react_1.useState)('');
    const [description, setDescription] = (0, react_1.useState)('');
    const [status, setStatus] = (0, react_1.useState)('todo');
    const [expectedDate, setExpectedDate] = (0, react_1.useState)('');
    const [subtasks, setSubtasks] = (0, react_1.useState)([]);
    (0, react_1.useEffect)(() => {
        if (task) {
            setTitle(task.title);
            setDescription(task.description);
            setStatus(task.status);
            setExpectedDate(task.expected_date || '');
        }
        else {
            setTitle('');
            setDescription('');
            setStatus('todo');
            setExpectedDate('');
            setSubtasks([]);
        }
    }, [task]);
    const handleAddSubtask = () => {
        setSubtasks([...subtasks, { id: Date.now(), title: '', completed: false }]);
    };
    const handleRemoveSubtask = (id) => {
        setSubtasks(subtasks.filter((s) => s.id !== id));
    };
    const handleUpdateSubtask = (id, field, value) => {
        setSubtasks(subtasks.map((s) => (s.id === id ? { ...s, [field]: value } : s)));
    };
    const handleSubmit = (e) => {
        e.preventDefault();
        if (!title.trim())
            return;
        const updatedTask = {
            title: title.trim(),
            description: description.trim(),
            status,
            expected_date: expectedDate || null,
        };
        if (task) {
            updatedTask.id = task.id;
        }
        onSave(updatedTask);
        subtasks.forEach((subtask) => {
            if (subtask.title.trim()) {
                const newSubtask = {
                    title: subtask.title.trim(),
                    description: '',
                    status: subtask.completed ? 'done' : 'todo',
                    parent_id: task?.id || null,
                    expected_date: null,
                };
                if (!task) {
                    onSave(newSubtask);
                }
            }
        });
        onClose();
    };
    if (!task && !title && !description && subtasks.length === 0) {
        return null;
    }
    return (react_1.default.createElement("div", { className: "modal-overlay", onClick: onClose },
        react_1.default.createElement("div", { className: "modal", onClick: (e) => e.stopPropagation() },
            react_1.default.createElement("div", { className: "modal-header" },
                react_1.default.createElement("h2", null, task ? '编辑任务' : '新建任务'),
                react_1.default.createElement("button", { className: "modal-close", onClick: onClose }, "\u00D7")),
            react_1.default.createElement("form", { onSubmit: handleSubmit, className: "modal-body" },
                react_1.default.createElement("div", { className: "form-group" },
                    react_1.default.createElement("label", null, "\u4EFB\u52A1\u6807\u9898"),
                    react_1.default.createElement("input", { type: "text", value: title, onChange: (e) => setTitle(e.target.value), placeholder: "\u8F93\u5165\u4EFB\u52A1\u6807\u9898", autoFocus: true, required: true })),
                react_1.default.createElement("div", { className: "form-group" },
                    react_1.default.createElement("label", null, "\u63CF\u8FF0"),
                    react_1.default.createElement("textarea", { value: description, onChange: (e) => setDescription(e.target.value), placeholder: "\u8F93\u5165\u4EFB\u52A1\u63CF\u8FF0\uFF08\u53EF\u9009\uFF09" })),
                react_1.default.createElement("div", { className: "form-group" },
                    react_1.default.createElement("label", null, "\u72B6\u6001"),
                    react_1.default.createElement("select", { value: status, onChange: (e) => setStatus(e.target.value) },
                        react_1.default.createElement("option", { value: "todo" }, "\uD83D\uDCDD Todo"),
                        react_1.default.createElement("option", { value: "wip" }, "\u26A1 WIP"),
                        react_1.default.createElement("option", { value: "waited" }, "\u23F3 Waited"),
                        react_1.default.createElement("option", { value: "done" }, "\u2705 Done"))),
                react_1.default.createElement("div", { className: "form-group" },
                    react_1.default.createElement("label", null, "\u671F\u671B\u5B8C\u6210\u65F6\u95F4"),
                    react_1.default.createElement("input", { type: "date", value: expectedDate, onChange: (e) => setExpectedDate(e.target.value) })),
                react_1.default.createElement("div", { className: "subtasks-section" },
                    react_1.default.createElement("div", { className: "subtasks-title" }, "\u5B50\u4EFB\u52A1"),
                    subtasks.map((subtask) => (react_1.default.createElement("div", { key: subtask.id, className: "subtask-item" },
                        react_1.default.createElement("input", { type: "checkbox", checked: subtask.completed, onChange: (e) => handleUpdateSubtask(subtask.id, 'completed', e.target.checked) }),
                        react_1.default.createElement("input", { type: "text", value: subtask.title, onChange: (e) => handleUpdateSubtask(subtask.id, 'title', e.target.value), placeholder: "\u5B50\u4EFB\u52A1\u6807\u9898" }),
                        react_1.default.createElement("button", { type: "button", onClick: () => handleRemoveSubtask(subtask.id) }, "\u00D7")))),
                    react_1.default.createElement("button", { type: "button", className: "add-subtask-btn", onClick: handleAddSubtask },
                        react_1.default.createElement("svg", { width: "16", height: "16", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2" },
                            react_1.default.createElement("path", { d: "M12 5v14M5 12h14" })),
                        "\u6DFB\u52A0\u5B50\u4EFB\u52A1")),
                react_1.default.createElement("div", { className: "modal-footer" },
                    react_1.default.createElement("button", { type: "button", className: "modal-btn cancel", onClick: onClose }, "\u53D6\u6D88"),
                    react_1.default.createElement("button", { type: "submit", className: "modal-btn save" }, "\u4FDD\u5B58"))))));
};
exports.TaskModal = TaskModal;
