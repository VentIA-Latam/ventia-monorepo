"use client";

import { useState } from "react";
import { FaBox, FaClock, FaTruck, FaCreditCard, FaUndo, FaQuestionCircle, FaTimes } from "react-icons/fa";

interface Topic {
  id: string;
  name: string;
  icon: React.ReactNode;
}

export default function KnowledgeBaseForm() {
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [showAddTopicModal, setShowAddTopicModal] = useState(false);
  const [newTopicName, setNewTopicName] = useState("");
  const [newTopicDescription, setNewTopicDescription] = useState("");
  const [selectedTopicType, setSelectedTopicType] = useState<string>("otros");
  const [showTopicTypeDropdown, setShowTopicTypeDropdown] = useState(false);

  const topics: Topic[] = [
    { id: "productos", name: "Productos", icon: <FaBox /> },
    { id: "horarios", name: "Horarios", icon: <FaClock /> },
    { id: "envios", name: "Envíos", icon: <FaTruck /> },
    { id: "pagos", name: "Pagos", icon: <FaCreditCard /> },
    { id: "devoluciones", name: "Devoluciones", icon: <FaUndo /> },
    { id: "otros", name: "Otros", icon: <FaQuestionCircle /> },
  ];

  return (
    <div className="bg-white rounded-lg p-6 shadow-sm border border-border">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-6 h-6 rounded-full border-2 border-aqua flex items-center justify-center">
          <div className="w-3 h-3 rounded-full bg-aqua"></div>
        </div>
        <h2 className="text-xl font-semibold text-ventia-blue">
          Base de conocimiento
        </h2>
      </div>

      {/* Topics tabs */}
      <div className="flex flex-wrap gap-3 mb-6 border-b pb-4">
        <button
          onClick={() => setSelectedTopic(null)}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            selectedTopic === null
              ? "text-volt bg-volt/10"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          }`}
        >
          Todas
        </button>
        {topics.map((topic) => (
          <button
            key={topic.id}
            onClick={() => setSelectedTopic(topic.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              selectedTopic === topic.id
                ? "text-volt bg-volt/10"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            {topic.icon}
            {topic.name}
          </button>
        ))}
      </div>

      {/* Add topic button */}
      <button
        onClick={() => setShowAddTopicModal(true)}
        className="w-full border-2 border-dashed border-border rounded-lg py-8 text-muted-foreground hover:border-aqua hover:text-aqua transition-colors flex items-center justify-center gap-2"
      >
        <span className="text-xl">+</span>
        <span className="font-medium">Agregar tema</span>
      </button>

      {/* Modal para agregar tema */}
      {showAddTopicModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-fadeIn">
          <div className="bg-white rounded-lg p-6 w-full max-w-md shadow-2xl animate-scaleIn">
            {/* Header del modal */}
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-foreground">
                Agregar tema
              </h3>
              <button
                onClick={() => {
                  setShowAddTopicModal(false);
                  setNewTopicName("");
                  setNewTopicDescription("");
                  setSelectedTopicType("otros");
                }}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <FaTimes />
              </button>
            </div>

            {/* Formulario */}
            <div className="space-y-4">
              {/* Input de tema */}
              <div>
                <input
                  type="text"
                  placeholder="Tema"
                  value={newTopicName}
                  onChange={(e) => setNewTopicName(e.target.value)}
                  className="w-full px-4 py-3 border border-border rounded-lg focus:outline-none focus:border-aqua focus:ring-1 focus:ring-aqua"
                />
              </div>

              {/* Textarea de descripción */}
              <div>
                <textarea
                  placeholder="Descripción"
                  value={newTopicDescription}
                  onChange={(e) => setNewTopicDescription(e.target.value)}
                  rows={4}
                  className="w-full px-4 py-3 border border-border rounded-lg focus:outline-none focus:border-aqua focus:ring-1 focus:ring-aqua resize-none"
                />
              </div>

              {/* Dropdown de tipo de tópico */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowTopicTypeDropdown(!showTopicTypeDropdown)}
                  className="w-full px-4 py-3 border border-border rounded-lg focus:outline-none focus:border-aqua focus:ring-1 focus:ring-aqua flex items-center justify-between text-sm text-muted-foreground"
                >
                  <div className="flex items-center gap-2">
                    {topics.find(t => t.id === selectedTopicType)?.icon}
                    <span>{topics.find(t => t.id === selectedTopicType)?.name}</span>
                  </div>
                  <svg
                    className={`w-4 h-4 transition-transform ${showTopicTypeDropdown ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {/* Dropdown menu */}
                {showTopicTypeDropdown && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setShowTopicTypeDropdown(false)}
                    />
                    <div className="absolute z-20 w-full mt-1 bg-white border border-border rounded-lg shadow-lg max-h-60 overflow-auto">
                      {topics.map((topic) => (
                        <button
                          key={topic.id}
                          type="button"
                          onClick={() => {
                            setSelectedTopicType(topic.id);
                            setShowTopicTypeDropdown(false);
                          }}
                          className={`w-full px-4 py-2 text-left flex items-center gap-2 text-sm hover:bg-muted transition-colors ${
                            selectedTopicType === topic.id ? 'bg-volt/10 text-volt' : 'text-muted-foreground'
                          }`}
                        >
                          {topic.icon}
                          <span>{topic.name}</span>
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Botones de acción */}
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => {
                  setShowAddTopicModal(false);
                  setNewTopicName("");
                  setNewTopicDescription("");
                  setSelectedTopicType("otros");
                }}
                className="px-4 py-2 text-muted-foreground hover:bg-muted rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  // Aquí iría la lógica para agregar el tema
                  console.log("Tema:", newTopicName, "Descripción:", newTopicDescription, "Tipo:", selectedTopicType);
                  setShowAddTopicModal(false);
                  setNewTopicName("");
                  setNewTopicDescription("");
                  setSelectedTopicType("otros");
                }}
                className="px-4 py-2 bg-marino text-white rounded-lg hover:bg-marino/80 transition-colors"
              >
                Agregar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Empty state */}
      <div className="mt-8 text-center py-12">
        <div className="text-6xl text-muted-foreground mb-4">?</div>
        <p className="text-muted-foreground">No hay temas</p>
      </div>
    </div>
  );
}