import logging
import os
from config.settings import settings

def get_logger(name: str, log_file: str = "system.log"):
    logger = logging.getLogger(name)
    if not logger.handlers:
        logger.setLevel(logging.DEBUG if settings.DEBUG else logging.INFO)
        formatter = logging.Formatter('%(asctime)s - %(name)s - [%(levelname)s] - %(message)s')
        
        # Console handler
        console_handler = logging.StreamHandler()
        console_handler.setFormatter(formatter)
        logger.addHandler(console_handler)
        
        # File handler
        log_path = os.path.join(settings.BASE_DIR, "logs", log_file)
        file_handler = logging.FileHandler(log_path)
        file_handler.setFormatter(formatter)
        logger.addHandler(file_handler)
        
        logger.propagate = False
    return logger

sys_logger = get_logger("system", "system.log")
rec_logger = get_logger("recognition", "recognition.log")
cam_logger = get_logger("camera", "camera.log")
err_logger = get_logger("error", "error.log")
