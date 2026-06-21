import React, { useState } from 'react';
import { Card, EmptyState } from '../components/shared/Cards';
import { getSelectedClusterContext } from '../utils/clusterContext';
import { useChat } from '../hooks/useApi';

export const AIAnalysis: React.FC = () => {
  const { cluster } = getSelectedClusterContext();
  const chatMutation = useChat();
  const [chatMessages, setChatMessages] = useState<
    { role: 'user' | 'assistant'; message: string }[]
  >([
    {
      role: 'assistant',
      message: cluster?.clusterName
        ? `I am connected to the analysis backend. How can I help you analyze ${cluster.clusterName}?`
        : 'Select a cluster in Workspace Setup before running AI analysis.',
    },
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSendMessage = async () => {
    if (!inputValue.trim()) return;

    const userMessage = inputValue;
    setInputValue('');
    setChatMessages((prev) => [
      ...prev,
      { role: 'user', message: userMessage },
    ]);

    setIsLoading(true);
    
    chatMutation.mutate(
      { message: userMessage, cluster_name: cluster?.clusterName },
      {
        onSuccess: (data) => {
          setChatMessages((prev) => [
            ...prev,
            { role: 'assistant', message: data.reply || 'No response from AI.' },
          ]);
          setIsLoading(false);
        },
        onError: () => {
          setChatMessages((prev) => [
            ...prev,
            { role: 'assistant', message: 'Error: Could not reach analysis backend.' },
          ]);
          setIsLoading(false);
        }
      }
    );
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card title="Latest RCA Summary">
          <EmptyState
            title="No RCA Available"
            message={`${cluster?.clusterName || 'Selected cluster'} has no incident RCA data yet.`}
          />
        </Card>

        <Card title="Similar Historical Incidents">
          <EmptyState
            title="No Similar Incidents"
            message="Historical matches will appear after incidents are ingested."
          />
        </Card>
      </div>

      <Card title="AI Assistant Chat" className="lg:col-span-2">
        <div className="flex h-96 flex-col">
          <div className="flex-1 space-y-4 overflow-y-auto pr-4">
            {chatMessages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-xs rounded-lg px-4 py-2 ${
                    msg.role === 'user'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-800 text-gray-300'
                  }`}
                >
                  {msg.message}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="rounded-lg bg-gray-800 px-4 py-2 text-gray-300">Analyzing...</div>
              </div>
            )}
          </div>

          <div className="mt-4 flex gap-2 border-t border-gray-700 pt-4">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSendMessage();
              }}
              placeholder={`Ask about ${cluster?.clusterName || 'this cluster'}...`}
              className="flex-1 rounded-lg border border-gray-700 bg-gray-800 px-4 py-2 text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
              disabled={isLoading}
            />
            <button
              onClick={handleSendMessage}
              disabled={isLoading}
              className="rounded-lg bg-blue-600 px-6 py-2 font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              Send
            </button>
          </div>
        </div>
      </Card>
    </div>
  );
};
