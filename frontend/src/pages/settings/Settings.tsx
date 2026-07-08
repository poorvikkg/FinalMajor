import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { Save, Server, Sliders } from 'lucide-react';

export const Settings: React.FC = () => {
  const [confidence, setConfidence] = useState(80);
  const [fastApiUrl, setFastApiUrl] = useState('http://localhost:8000');
  const [saveSuccess, setSaveSuccess] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2000);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">System Diagnostics & Settings</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Fine-tune facial recognition accuracy parameters and network microservice connections.</p>
      </div>

      <div className="max-w-2xl">
        <form onSubmit={handleSave} className="space-y-6">
          {saveSuccess && (
            <div className="p-3 text-xs bg-emerald-950/30 border border-emerald-900/40 text-emerald-400 rounded-lg text-center font-medium">
              System configuration saved successfully.
            </div>
          )}

          {/* AI Settings */}
          <Card>
            <CardHeader className="flex flex-row items-center gap-3">
              <Sliders className="h-5 w-5 text-primary-500" />
              <CardTitle>AI Recognition Accuracy Threshold</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                    Confidence Verification Index
                  </label>
                  <Badge variant="primary">{confidence}% Match</Badge>
                </div>
                <input
                  type="range"
                  min="50"
                  max="99"
                  value={confidence}
                  onChange={(e) => setConfidence(parseInt(e.target.value))}
                  className="w-full h-1.5 bg-slate-200 dark:bg-dark-900 rounded-lg appearance-none cursor-pointer accent-primary-600"
                />
                <p className="text-xs text-slate-450 mt-1.5 leading-relaxed">
                  Requires the classification engine to confirm matching criteria parameters before registering identities.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Server Connections */}
          <Card>
            <CardHeader className="flex flex-row items-center gap-3">
              <Server className="h-5 w-5 text-primary-500" />
              <CardTitle>Microservices Architecture Endpoints</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input
                label="Python AI Core Endpoint URL"
                placeholder="http://localhost:8000"
                value={fastApiUrl}
                onChange={(e) => setFastApiUrl(e.target.value)}
                required
              />
              <p className="text-xs text-slate-455">
                Surveillance pipeline communicates with this FastAPI endpoint for video parsing and face vector generation.
              </p>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button type="submit" className="flex items-center gap-2">
              <Save className="h-4.5 w-4.5" /> Save Configuration
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
export default Settings;
