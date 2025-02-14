import React from 'react';
import { Modal, Button } from 'react-bootstrap';

const ImageModal = ({ show, handleClose, imageUrl }) => {
    return (
        <Modal show={show} onHide={handleClose} centered>
            <Modal.Body style={{ padding: 0 }}>
                <img src={imageUrl} alt="Product" style={{ width: '100%' }} />
                <Button variant="secondary" onClick={handleClose} style={{ position: 'absolute', top: 10, right: 10 }}>×</Button>
            </Modal.Body>
        </Modal>
    );
};

export default ImageModal;
