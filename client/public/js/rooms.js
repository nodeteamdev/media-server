const initModals = () => {
    M.Modal.init(document.querySelectorAll('.modal'));
};

const bindButtons = () => {
    document.getElementById('createRoom').addEventListener('click', () => {
        const roomName = document.getElementById('roomName').value;

        fetch('/room/create', {
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
            },
            method: 'POST',
            body: JSON.stringify({
                roomName,
            }),
        }).then((res) => res.json()).then(({ data, error }) => {
            if (error) {
                throw new Error(error);
            }
            window.location.href = data.id;
        });
    });

    document.getElementById('deleteRoom').addEventListener('click', function() {
        const roomId = this.dataset.id;

        fetch('/room/delete', {
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
            },
            method: 'DELETE',
            body: JSON.stringify({
                id: roomId,
            }),
        }).then((res) => res.json()).then(({error }) => {
            if (error) {
                throw new Error(error);
            }
            window.location.href = '/room/list';
        });
    });
};

document.addEventListener('DOMContentLoaded', () => {
    initModals();
    bindButtons();
});
