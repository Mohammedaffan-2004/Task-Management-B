const emitUpdates = (req, events = []) => {
  try {
    const io = req.app.get("io");
    if (!io) return;
    
   
    events.forEach((eventName) => {
      io.emit(eventName, { 
        message: `${eventName} triggered`, 
        timestamp: new Date().toISOString() 
      });
    });
  } catch (err) {
    console.error("Socket emit failed:", err.message);
  }
};

module.exports = emitUpdates;