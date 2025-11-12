function AINewsWidget({ news }) {
  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <div className="flex items-center gap-3 mb-4">
        <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
        <div>
          <h3 className="text-lg font-bold text-gray-800">AI Insights</h3>
          <p className="text-xs text-gray-600">Top trending prediction topics right now</p>
        </div>
      </div>
      
      {news.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <div className="text-4xl mb-2">📰</div>
          <p className="text-sm">Loading trending topics...</p>
        </div>
      ) : (
        <div className="space-y-4">
          {news.slice(0, 3).map((item, index) => (
            <div 
              key={index}
              className="p-4 bg-gradient-to-br from-purple-50 to-pink-50 rounded-lg border border-purple-200 hover:shadow-md transition-all"
            >
              <div className="flex items-start gap-2 mb-2">
                <span className="text-xl">{item.icon || '📌'}</span>
                <div className="flex-1">
                  <h4 className="font-semibold text-gray-800 text-sm mb-1">
                    {item.category || 'Trending'}
                  </h4>
                  <p className="text-sm text-gray-700 leading-relaxed">
                    {item.headline}
                  </p>
                </div>
              </div>
              {item.source_url && (
                
                  href={item.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-purple-600 hover:underline flex items-center gap-1 mt-2"
                >
                  📰 Read full article →
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default AINewsWidget;
