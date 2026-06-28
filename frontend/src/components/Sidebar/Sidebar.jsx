import { NODE_COLORS } from '../../constants';
import './Sidebar.css';

const DRAGGABLE_NODES = [
  {
    type: 'send_message',
    icon: '💬',
    name: 'Send Message',
    desc: 'Send a text message to the user',
  },
  {
    type: 'ask_question',
    icon: '❓',
    name: 'Ask Question',
    desc: 'Ask user a question with buttons or text',
  },
  {
    type: 'condition',
    icon: '🔀',
    name: 'Condition',
    desc: 'Branch based on variable values',
  },
];

export default function Sidebar() {
  const onDragStart = (event, nodeType) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <aside className="sidebar">
      <div className="sidebar__header">
        <div className="sidebar__title">Node Palette</div>
      </div>

      <div className="sidebar__nodes">
        {DRAGGABLE_NODES.map((node) => (
          <div
            key={node.type}
            className={`sidebar__node-item sidebar__node-item--${node.type}`}
            draggable
            onDragStart={(e) => onDragStart(e, node.type)}
          >
            <div className="sidebar__node-icon">{node.icon}</div>
            <div className="sidebar__node-info">
              <div className="sidebar__node-name">{node.name}</div>
              <div className="sidebar__node-desc">{node.desc}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="sidebar__footer">
        Drag nodes onto the canvas
      </div>
    </aside>
  );
}
