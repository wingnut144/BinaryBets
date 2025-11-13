function AIResolutionInfo() {
  return (
    <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-6 mb-6">
      <div className="flex items-start gap-4">
        <div className="text-4xl">🤖</div>
        <div className="flex-1">
          <h3 className="text-xl font-bold text-gray-800 mb-2">
            AI-Powered Market Resolution
          </h3>
          <p className="text-gray-700 mb-3">
            Our AI system checks all markets daily at 1:00 AM. If the outcome of a market 
            becomes definitively clear before the deadline, the AI will resolve it early.
          </p>
          <div className="bg-white rounded-lg p-4 mb-3">
            <h4 className="font-bold text-gray-800 mb-2">How it works:</h4>
            <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
              <li>AI evaluates markets using ChatGPT and Claude</li>
              <li>Markets only resolve if AI is 95%+ confident</li>
              <li>Winners are paid out immediately upon resolution</li>
              <li>Uncertain outcomes keep markets open</li>
            </ul>
          </div>
          <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-200">
            <h4 className="font-bold text-gray-800 mb-2">📬 If Your Market Closes Early:</h4>
            <p className="text-sm text-gray-700 mb-2">
              You'll receive an <strong>in-app notification</strong> and an <strong>email</strong> explaining why.
            </p>
            <p className="text-sm text-gray-700">
              If you believe the closure was incorrect, you can <strong>restore your market</strong> 
              with one click from your notifications. The restored market will have AI resolution 
              disabled, and all bets will be transferred automatically.
            </p>
          </div>
          <div className="mt-4 text-sm text-gray-600">
            💡 <strong>Tip:</strong> Check the "Skip AI Resolution" option when creating a market 
            if you prefer to resolve it manually.
          </div>
        </div>
      </div>
    </div>
  );
}

export default AIResolutionInfo;
